"use strict"

###
Module Dependencies
###
User          = require("../models/User")
async         = require("async")
crypto        = require("crypto")
config        = require("../config/config")
passport      = require("passport")
nodemailer    = require("nodemailer")
LoginAttempt  = require("../models/LoginAttempt")

###
User Controller
###
module.exports.controller = (app) ->

  ###
  GET /login
  Render login page
  ###
  app.get "/login", (req, res) ->

    # Check if user is already logged in
    if req.user
      req.flash "info",
        msg: "You are already logged in!"
      return res.redirect "/api"

    # Turn off login form if too many attempts
    tooManyAttempts = req.session.tooManyAttempts or false
    req.session.tooManyAttempts = null

    # Render Login form
    res.render "account/login",
      tooManyAttempts: tooManyAttempts
      url: req.url

  ###
  POST /login
  Log the user in
  ###
  app.post "/login", (req, res, next) ->

    # Begin a workflow
    workflow = new (require("events").EventEmitter)()

    ###
    Step 1: Validate the data
    ###
    workflow.on "validate", ->

      # Validate the form fields
      req.assert("email", "Your email cannot be empty.").notEmpty()
      req.assert("email", "Your email is not valid").isEmail()
      req.assert("password", "Your password cannot be blank").notEmpty()
      req.assert("password", "Your password must be at least 4 characters long.").len 4
      errors = req.validationErrors()
      if errors
        req.flash "error", errors
        return res.redirect "/login"
      # next step
      workflow.emit "abuseFilter"

    ###
    Step 2: Prevent brute force login hacking
    ###
    workflow.on "abuseFilter", ->
      getIpCount = (done) ->
        conditions = ip: req.ip
        LoginAttempt.count conditions, (err, count) ->
          return done(err)  if err
          done null, count

      getIpUserCount = (done) ->
        conditions =
          ip: req.ip
          user: req.body.email.toLowerCase()
        LoginAttempt.count conditions, (err, count) ->
          return done(err)  if err
          done null, count

      asyncFinally = (err, results) ->
        return workflow.emit("exception", err)  if err
        if results.ip >= config.loginAttempts.forIp or results.ipUser >= config.loginAttempts.forUser
          req.flash "error",
            msg: "You've reached the maximum number of login attempts. Please try again later or reset your password."
          req.session.tooManyAttempts = true
          return res.redirect "/login"
        else
          workflow.emit "authenticate"

      async.parallel
        ip: getIpCount
        ipUser: getIpUserCount
      , asyncFinally

    ###
    Step 3: Authenticate the user
    ###
    workflow.on "authenticate", ->
      # Authenticate the user
      passport.authenticate("local", (err, user, info) ->
        if err
          req.flash "error",
            msg: err.message
          return res.redirect "back"
        if !user
          # Update abuse count
          fieldsToSet =
            ip: req.ip
            user: req.body.email
          LoginAttempt.create fieldsToSet, (err, doc) ->
            if err
              req.flash "error",
                msg: err.message
              return res.redirect "back"
            else
              # User Not Found (Return)
              req.flash "error",
                msg: info.message
              return res.redirect "/login"
        else
          # update the user's record with login timestamp
          user.activity.last_logon = Date.now()
          user.save (err) ->
            if err
              req.flash "error",
                msg: err.message
              return res.redirect "back"
          # Log user in
          req.logIn user, (err) ->
            if err
              req.flash "error",
                msg: err.message
              return res.redirect "back"
            # Send user on their merry way
            if req.session.attemptedURL
              redirectURL = req.session.attemptedURL
              delete req.session.attemptedURL
              res.redirect redirectURL
            else
              res.redirect "/api"
      ) req, res, next

    ###
    Initiate the workflow
    ###
    workflow.emit "validate"

  ###
  GET /logout
  Log the user out
  ###
  app.get "/logout", (req, res) ->
    # Augment Logout to handle enhanced security
    delete req.session.passport.secondFactor
    req.logout()
    res.redirect "/"

  ###
  GET /verify/:id/:token
  Verify the user after signup
  ###
  app.get "/verify/:id/:token", (req, res) ->
    # Create a workflow
    workflow = new (require("events").EventEmitter)()

    ###
    Step 1: Validate the user and token
    ###
    workflow.on "validate", ->

      # Get the user using their ID and token
      User.findOne
        _id: req.params.id
        verifyToken: req.params.token
      , (err, user) ->
        if err
          req.flash "error",
            msg: err.message
          req.flash "warning",
            msg: "Your account verification is invalid or has expired."
          return res.redirect "/"
        if !user
          req.flash "warning",
            msg: "Your password reset request is invalid or has expired."
          res.redirect "/"
        else
          # Let's verify the user!
          user.verified = true
          user.verifyToken = 'undefined'
          user.activity.last_logon = Date.now()
          # update the user record
          user.save (err) ->
            if err
              req.flash "error",
                msg: err.message
              return res.redirect "back"
            # next step
            workflow.emit "sendWelcomeEmail", user

    ###
    Step 2: Send them a welcome email
    ###
    workflow.on "sendWelcomeEmail", (user) ->
      # Create a reusable nodemailer transport method (opens a pool of SMTP connections)
      smtpTransport = nodemailer.createTransport("SMTP",
        service: "Gmail"
        auth:
          user: config.gmail.user
          pass: config.gmail.password
      )

      # Render HTML to send using .jade mail template (just like rendering a page)
      res.render "mail/welcome",
        name:          user.profile.name
        mailtoName:    config.smtp.name
        mailtoAddress: config.smtp.address
        blogLink:      req.protocol + '://' + req.headers.host + '/blog',
        forumLink:     req.protocol + '://' + req.headers.host + '/forum'
      , (err, html) ->
        if err
          return err null
        else
          # Now create email text (multiline string as array FTW)
          text = [
            "Hello " + user.profile.name + "!"
            "We would like to welcome you as our newest member!"
            "Thanks so much for using our services! If you have any questions, or suggestions, feel free to email us here at " + config.smtp.address + "."
            "If you want to get the latest scoop check out our <a href='" + blogLink + "'>blog</a> and our <a href='" + forumLink + "'>forums</a>."
            "  - The " + config.smtp.name + " team"
          ].join("\n\n")

          # Create email
          mailOptions =
            to:       user.profile.name + " <" + user.email + ">"
            from:     config.smtp.name + " <" + config.smtp.address + ">"
            subject:  "Welcome to " + app.locals.application + "!"
            text:     text
            html:     html

          # send email via nodemailer
          smtpTransport.sendMail mailOptions, (err) ->
            if err
              req.flash "error",
                msg: err.message
            # shut down the connection pool, no more messages
            smtpTransport.close()

      # next step
      workflow.emit "logUserIn", user

    ###
    Step 3: Log them in
    ###
    workflow.on "logUserIn", (user) ->
      # log the user in
      req.logIn user, (err) ->
        if err
          req.flash "error",
            msg: err.message
          return res.redirect "back"
        req.flash "info",
          msg: "Your account verification is completed!"
        res.redirect "/api"
      # WORKFLOW COMPLETED

    ###
    Initiate the workflow
    ###
    workflow.emit "validate"

  ###
  GET /signup
  Render signup page
  ###
  app.get "/signup", (req, res) ->
    return res.redirect "/"  if req.user
    res.render "account/signup",
      url: req.url

  ###
  POST /signup
  Process a *regular* signup
  ###
  app.post "/signup", (req, res, next) ->
    # Begin a workflow
    workflow = new (require("events").EventEmitter)()
    ###
    Step 1: Validate the form fields
    ###
    workflow.on "validate", ->
      # Check for form errors
      req.assert("name", "Your name cannot be empty.").notEmpty()
      req.assert("email", "Your email cannot be empty.").notEmpty()
      req.assert("email", "Your email is not valid.").isEmail()
      req.assert("password", "Your password cannot be empty.").notEmpty()
      req.assert("confirmPassword", "Your password confirmation cannot be empty.").notEmpty()
      req.assert("password", "Your password must be at least 4 characters long.").len 4
      req.assert("confirmPassword", "Your passwords do not match.").equals req.body.password
      errors = req.validationErrors()
      if errors
        req.flash "error", errors
        return res.redirect "back"
      # next step
      workflow.emit "verification"

    ###
    Step 2: Account verification step
    ###
    workflow.on "verification", ->
      verified = undefined
      verifyToken = undefined
      if config.verificationRequired
        verified = false
        # generate verification token
        crypto.randomBytes 25, (err, buf) ->
          verifyToken = buf.toString("hex")
          # next step
          workflow.emit "createUser", verified, verifyToken
      else
        verified = true
        verifyToken = null
        # next step
        workflow.emit "createUser", verified, verifyToken

    ###
    Step 3: Create a new account
    ###
    workflow.on 'createUser', (verified, verifyToken) ->
      # create user
      user = new User(
        'profile.name': req.body.name.trim()
        email:          req.body.email.toLowerCase()
        password:       req.body.password
        verifyToken:    verifyToken
        verified:       verified
      )
      # save user
      user.save (err) ->
        if err
          if err.code is 11000
            req.flash "error",
              msg: "An account with that email address already exists!"
            req.flash "info",
              msg: "You should sign in with that account."
          return res.redirect "back"
        else
          if config.verificationRequired
            # next step (4a)
            workflow.emit "sendValidateEmail", user, verifyToken
          else
            # next step (4b)
            workflow.emit "sendWelcomeEmail", user

    ###
    Step 4a: Send them a validate email
    ###
    workflow.on "sendValidateEmail", (user, verifyToken) ->
      # Create a reusable nodemailer transport method (opens a pool of SMTP connections)
      smtpTransport = nodemailer.createTransport("SMTP",
        service: "Gmail"
        auth:
          user: config.gmail.user
          pass: config.gmail.password
      )
      # Render HTML to send using .jade mail template (just like rendering a page)
      res.render "mail/accountVerification",
        name:         user.profile.name
        mailtoName:   config.smtp.name
        validateLink: req.protocol + "://" + req.headers.host + "/verify/" + user.id + "/" + verifyToken
      , (err, html) ->
        if err
          return err null
        else
          # Now create email text (multiline string as array FTW)
          text = [
            "Hello " + user.profile.name + "!"
            "Welcome to " + app.locals.application + "!  Here is a special link to activate your new account:"
            req.protocol + "://" + req.headers.host + "/verify/" + user.id + "/" + user.verifyToken
            "  - The " + config.smtp.name + " team"
          ].join("\n\n")

          # Create email
          mailOptions =
            to:      user.profile.name + " <" + user.email + ">"
            from:    config.smtp.name + " <" + config.smtp.address + ">"
            subject: "Activate your new " + app.locals.application + " account"
            text:    text
            html:    html

          # send email via nodemailer
          smtpTransport.sendMail mailOptions, (err) ->
            if err
              req.flash "error",
                msg: err.message
            # shut down the connection pool, no more messages
            smtpTransport.close()

      req.flash "info",
        msg: "Please check your email to verify your account. Thanks for signing up!"
      res.redirect "/signup"
      # WORKFLOW COMPLETED

    ###
    Step 4b: Send them a welcome email
    ###
    workflow.on "sendWelcomeEmail", (user) ->
      # Create a reusable nodemailer transport method (opens a pool of SMTP connections)
      smtpTransport = nodemailer.createTransport("SMTP",
        service: "Gmail"
        auth:
          user: config.gmail.user
          pass: config.gmail.password
      )

      # Render HTML to send using .jade mail template (just like rendering a page)
      res.render "mail/welcome",
        name: user.profile.name
        mailtoName: config.smtp.name
        mailtoAddress: config.smtp.address
        blogLink: req.protocol + "://" + req.headers.host + '/blog',
        forumLink: req.protocol + "://" + req.headers.host + '/forum'
      , (err, html) ->
        if err
          return err null
        else
          # Now create email text (multiline string as array FTW)
          text = [
            "Hello " + user.profile.name + "!"
            "We would like to welcome you as our newest member!"
            "Thanks so much for using our services! If you have any questions, or suggestions, feel free to email us here at " + config.smtp.address + "."
            "If you want to get the latest scoop check out our <a href='" + blogLink + "'>blog</a> and our <a href='" + forumLink + "'>forums</a>."
            "  - The " + config.smtp.name + " team"
          ].join("\n\n")

          # Create email
          mailOptions =
            to:      user.profile.name + " <" + user.email + ">"
            from:    config.smtp.name + " <" + config.smtp.address + ">"
            subject: "Welcome to " + app.locals.application + "!"
            text:    text
            html:    html

          # send email via nodemailer
          smtpTransport.sendMail mailOptions, (err) ->
            if err
              req.flash "error",
                msg: err.message
            # shut down the connection pool, no more messages
            smtpTransport.close()

      # next step
      workflow.emit "logUserIn", user

    ###
    Step 5: Log them in
    ###
    workflow.on "logUserIn", (user) ->
      # log the user in
      req.logIn user, (err) ->
        if err
          req.flash "error",
            msg: err.message
          return res.redirect "back"
        # send the right welcome message
        if config.twoFactor
          req.flash "warning",
            msg: "Welcome! We recommend turning on enhanced security in account settings."
          res.redirect "/api"
        else
          req.flash "info",
            msg: "Thanks for signing up! You rock!"
          res.redirect "/api"
      # WORKFLOW COMPLETED

    ###
    Initiate the workflow
    ###
    workflow.emit "validate"

  ###
  GET /signupsocial
  Confirm social email address
  ###
  app.get "/signupsocial", (req, res) ->
    res.render "account/signupsocial",
      url: req.url
      email: ""

  ###
  POST /signupsocial
  Process a *Social* signup & confirm email address
  ###
  app.post "/signupsocial", (req, res, next) ->

    # Begin a workflow
    workflow = new (require("events").EventEmitter)()

    ###
    Step 1: Validate the form fields
    ###
    workflow.on "validate", ->
      # Check for form errors
      req.assert("email", "Your email cannot be empty.").notEmpty()
      req.assert("email", "Your email is not valid.").isEmail()
      errors = req.validationErrors()
      if errors
        req.flash "error", errors
        return res.redirect "/signupsocial"
      # next step
      workflow.emit "duplicateEmailCheck"

    ###
    Step 2: Make sure the email address is unique
    ###
    workflow.on "duplicateEmailCheck", ->
      # Make sure we have a unique email address!
      User.findOne
        email: req.body.email.toLowerCase()
      , (err, user) ->
        if err
          req.flash "error",
            msg: err.msg
          return res.redirect "/signupsocial"
        if user
          req.flash "error",
            msg: "Sorry that email address has already been used!"
          req.flash "info",
            msg: "You can sign in with that account and link this provider, or you can create a new account by entering a different email address."
          return res.redirect "/signupsocial"
        else
          # next step
          workflow.emit "createUser"

    ###
    Step 4: Create a new account
    ###
    workflow.on "createUser", ->
      newUser = req.session.socialProfile
      user = new User()

      user.verified         = true # social users don't require verification
      user.email            = req.body.email.toLowerCase()
      user.profile.name     = newUser.profile.name
      user.profile.gender   = newUser.profile.gender
      user.profile.location = newUser.profile.location
      user.profile.website  = newUser.profile.website
      user.profile.picture  = newUser.profile.picture

      if newUser.source is "twitter"
        user.twitter = newUser.id
        user.tokens.push
          kind: "twitter"
          token: newUser.token
          tokenSecret: newUser.tokenSecret

      else if newUser.source is "facebook"
        user.facebook = newUser.id
        user.tokens.push
          kind: "facebook"
          accessToken: newUser.accessToken
          refreshToken: newUser.refreshToken

      else if newUser.source is "github"
        user.github = newUser.id
        user.tokens.push
          kind: "github"
          accessToken: newUser.accessToken
          refreshToken: newUser.refreshToken

      else if newUser.source is "google"
        user.google = newUser.id
        user.tokens.push
          kind: "google"
          accessToken: newUser.accessToken
          refreshToken: newUser.refreshToken

      # save user
      user.save (err) ->
        if err
          if err.code is 11000
            req.flash "error",
              msg: "An account with that email already exists!"
          return res.redirect "/signupsocial"
        else
          # next step
          workflow.emit "sendWelcomeEmail", user

    ###
    Step 5: Send them a welcome email
    ###
    workflow.on "sendWelcomeEmail", (user) ->
      # Create a reusable nodemailer transport method (opens a pool of SMTP connections)
      smtpTransport = nodemailer.createTransport("SMTP",
        service: "Gmail"
        auth:
          user: config.gmail.user
          pass: config.gmail.password
      )

      # Render HTML to send using .jade mail template (just like rendering a page)
      res.render "mail/welcome",
        name: user.profile.name
        mailtoName: config.smtp.name
        mailtoAddress: config.smtp.address
        blogLink: req.protocol + "://" + req.headers.host + '/blog',
        forumLink: req.protocol + "://" + req.headers.host + '/forum'
      , (err, html) ->
        if err
          return err null
        else
          # Now create email text (multiline string as array FTW)
          text = [
            "Hello " + user.profile.name + "!"
            "We would like to welcome you as our newest member!"
            "Thanks so much for using our services! If you have any questions, or suggestions, feel free to email us here at " + config.smtp.address + "."
            "If you want to get the latest scoop check out our <a href='" + blogLink + "'>blog</a> and our <a href='" + forumLink + "'>forums</a>."
            "  - The " + config.smtp.name + " team"
          ].join("\n\n")

          # Create email
          mailOptions =
            to:      user.profile.name + " <" + user.email + ">"
            from:    config.smtp.name + " <" + config.smtp.address + ">"
            subject: "Welcome to " + app.locals.application + "!"
            text:    text
            html:    html

          # send email via nodemailer
          smtpTransport.sendMail mailOptions, (err) ->
            if err
              req.flash "error",
                msg: err.message
            # shut down the connection pool, no more messages
            smtpTransport.close()

      # next step
      workflow.emit "logUserIn", user

    ###
    Step 6: Log them in
    ###
    workflow.on "logUserIn", (user) ->
      # log the user in
      req.logIn user, (err) ->
        return next(err)  if err
        req.flash "info",
          msg: "Thanks for signing up! You rock!"
        res.redirect "/api"

    ###
    Initiate the workflow
    ###
    workflow.emit "validate"

  ###
  Facebook Authentication
  ###
  app.get "/auth/facebook", passport.authenticate("facebook",
    callbackURL: "/auth/facebook/callback"
  )

  app.get "/auth/facebook/callback", (req, res, next) ->
    passport.authenticate("facebook",
      callbackURL: "/auth/facebook/callback"
      failureRedirect: "/login"
    , (err, user, info) ->

      # Check for data
      if !info or !info.profile
        req.flash "error",
          msg: "We have no data. Something went wrong!"
        return res.redirect "/login"

      # Do we already have a user with this Facebook ID?
      # If so, then it's just a login - timestamp it.
      User.findOne
        facebook: info.profile._json.id
      , (err, justLogin) ->
        return next(err)  if err
        if justLogin
          # Update the user's record with login timestamp
          justLogin.activity.last_logon = Date.now()
          justLogin.save (err) ->
            return next(err)  if err
            # Log the user in
            req.login justLogin, (err) ->
              return next(err)  if err
              # Send user on their merry way
              if req.session.attemptedURL
                redirectURL = req.session.attemptedURL
                delete req.session.attemptedURL
                return res.redirect redirectURL
              else
                return res.redirect "/api"
        else
          # Brand new Facebook user!
          # Save their profile data into the session
          newSocialUser                    = {}
          newSocialUser.source             = "facebook"
          newSocialUser.id                 = info.profile._json.id
          newSocialUser.accessToken        = info.accessToken
          newSocialUser.refreshToken       = info.refreshToken
          newSocialUser.email              = info.profile._json.email

          newSocialUser.profile            = {}
          newSocialUser.profile.name       = info.profile._json.name
          newSocialUser.profile.gender     = info.profile._json.gender
          newSocialUser.profile.location   = info.profile._json.location.name
          newSocialUser.profile.website    = info.profile._json.link
          newSocialUser.profile.picture    = "https://graph.facebook.com/" + info.profile.id + "/picture?type=large"

          req.session.socialProfile        = newSocialUser
          res.render "account/signupsocial",
            email: newSocialUser.email
    ) req, res, next

  ###
  Github Authentication
  ###
  app.get "/auth/github", passport.authenticate("github",
    callbackURL: "/auth/github/callback"
  )
  app.get "/auth/github/callback", (req, res, next) ->
    passport.authenticate("github",
      callbackURL: "/auth/github/callback"
      failureRedirect: "/login"
    , (err, user, info) ->
      if !info or !info.profile
        req.flash "error",
          msg: "We have no data. Something went wrong!"
        return res.redirect "/login"

      # Do we already have a user with this GitHub ID?
      # If so, then it's just a login - timestamp it.
      User.findOne
        github: info.profile._json.id
      , (err, justLogin) ->
        return next(err)  if err
        if justLogin
          # Update the user's record with login timestamp
          justLogin.activity.last_logon = Date.now()
          justLogin.save (err) ->
            return next(err)  if err
            # Log the user in
            req.login justLogin, (err) ->
              return next(err)  if err
              # Send user on their merry way
              if req.session.attemptedURL
                redirectURL = req.session.attemptedURL
                delete req.session.attemptedURL
                return res.redirect redirectURL
              else
                return res.redirect "/api"
        else
          # Brand new GitHub user!
          # Save their profile data into the session
          newSocialUser                  = {}
          newSocialUser.source           = "github"
          newSocialUser.id               = info.profile._json.id
          newSocialUser.accessToken      = info.accessToken
          newSocialUser.refreshToken     = info.refreshToken
          newSocialUser.email            = info.profile._json.email

          newSocialUser.profile          = {}
          newSocialUser.profile.name     = info.profile._json.name
          newSocialUser.profile.gender   = "" # No gender from Github
          newSocialUser.profile.location = info.profile._json.location
          newSocialUser.profile.website  = info.profile._json.html_url
          newSocialUser.profile.picture  = info.profile._json.avatar_url

          req.session.socialProfile      = newSocialUser
          res.render "account/signupsocial",
            email: newSocialUser.email
    ) req, res, next

  ###
  Google Authentication
  ###
  app.get "/auth/google", passport.authenticate("google",
    callbackURL: "/auth/google/callback"
  )
  app.get "/auth/google/callback", (req, res, next) ->
    passport.authenticate("google",
      callbackURL: "/auth/google/callback"
      failureRedirect: "/login"
    , (err, user, info) ->
      if !info or !info.profile
        req.flash "error",
          msg: "We have no data. Something went wrong!"
        return res.redirect "/login"

      # Do we already have a user with this Google ID?
      # If so, then it's just a login - timestamp it.
      User.findOne
        google: info.profile._json.id
      , (err, justLogin) ->
        return next(err)  if err
        if justLogin
          # Update the user's record with login timestamp
          justLogin.activity.last_logon = Date.now()
          justLogin.save (err) ->
            return next(err)  if err
            # Log the user in
            req.login justLogin, (err) ->
              return next(err)  if err
              # Send user on their merry way
              if req.session.attemptedURL
                redirectURL = req.session.attemptedURL
                delete req.session.attemptedURL
                return res.redirect redirectURL
              else
                return res.redirect "/api"
        else
          # Brand new Google user!
          # Save their profile data into the session
          newSocialUser                  = {}
          newSocialUser.source           = "google"
          newSocialUser.id               = info.profile.id
          newSocialUser.accessToken      = info.accessToken
          newSocialUser.refreshToken     = info.refreshToken
          newSocialUser.email            = info.profile._json.email

          newSocialUser.profile          = {}
          newSocialUser.profile.name     = info.profile._json.name
          newSocialUser.profile.gender   = info.profile._json.gender
          newSocialUser.profile.location = "" # No location from Google
          newSocialUser.profile.website  = info.profile._json.link
          newSocialUser.profile.picture  = info.profile._json.picture

          req.session.socialProfile      = newSocialUser
          res.render "account/signupsocial",
            email: newSocialUser.email
    ) req, res, next

  ###
  Twitter Authentication
  ###
  app.get "/auth/twitter", passport.authenticate("twitter",
    callbackURL: "/auth/twitter/callback"
  )
  app.get "/auth/twitter/callback", (req, res, next) ->
    passport.authenticate("twitter",
      callbackURL: "/auth/twitter/callback"
      failureRedirect: "/login"
    , (err, user, info) ->
      if !info or !info.profile
        req.flash "error",
          msg: "We have no data. Something went wrong!"
        return res.redirect "/login"

      # Do we already have a user with this Twitter ID?
      # If so, then it's just a login - timestamp it.
      User.findOne
        twitter: info.profile._json.id
      , (err, justLogin) ->
        return next(err)  if err
        if justLogin
          # Update the user's record with login timestamp
          justLogin.activity.last_logon = Date.now()
          justLogin.save (err) ->
            return next(err)  if err
            # Log the user in
            req.login justLogin, (err) ->
              return next(err)  if err
              # Send user on their merry way
              if req.session.attemptedURL
                redirectURL = req.session.attemptedURL
                delete req.session.attemptedURL
                return res.redirect redirectURL
              else
                return res.redirect "/api"
        else
          # Brand new Twitter user!
          # Save their profile data into the session
          newSocialUser                  = {}
          newSocialUser.source           = "twitter"
          newSocialUser.id               = info.profile.id
          newSocialUser.token            = info.token
          newSocialUser.tokenSecret      = info.tokenSecret
          newSocialUser.email            = "" # Twitter does not provide email addresses

          newSocialUser.profile          = {}
          newSocialUser.profile.name     = info.profile._json.name
          newSocialUser.profile.gender   = "" # No gender from Twitter either
          newSocialUser.profile.location = info.profile._json.location or ""

          # // Twitter may or may not provide a URL
          if typeof info.profile._json.entities.url isnt "undefined"
            newSocialUser.profile.website = info.profile._json.entities.url.urls[0].expanded_url
          else
            newSocialUser.profile.website = ""
          newSocialUser.profile.picture   = info.profile._json.profile_image_url
          req.session.socialProfile       = newSocialUser
          res.render "account/signupsocial",
            email: newSocialUser.email
    ) req, res, next
