# Skeleton 

[![Dependency Status](https://david-dm.org/dstroot/skeleton.png?theme=shields.io)](https://david-dm.org/dstroot/skeleton) 
[![devDependency Status](https://david-dm.org/dstroot/skeleton/dev-status.png?theme=shields.io)](https://david-dm.org/dstroot/skeleton#info=devDependencies)

### Skeleton: A **complete framework** for building **Node.js** web applications.

### **Live Demo**: [Skeleton](http://skeleton-app.jit.su) 

![Alt](https://lh6.googleusercontent.com/-uKeCLpArf-8/UwashLnJ4gI/AAAAAAAABvg/frUvl_qroCM/w951-h891-no/Skeleton.jpg)

There are many excellent Node/Express/Mongo frameworks out there. I have played with many, and contributed to a few of them. Since there is really no one "right" way to do things you kind of have to explore.  Once I did that I found that none of them were "just right" as Goldilocks would say. So I built this one! 

I borrowed heavily from [Hackathon-starter](https://github.com/sahat/hackathon-starter) and [Drywall](https://github.com/jedireza/drywall). The reason is third party OAUTH authentication is painful. [Passportjs](http://passportjs.org/) helps tremendously but there are not many good examples of how to use it. Both of these frameworks really show how it's done. Both are actively maintained and are really great starting points. I recommend either of them **highly**. 

Of the two, Drywall is more sophisticated. It has an extensive User/Account/Roles system to handle different types of accounts and account permissions.  It also has a very cool Administration area. In addition, the client side uses Backbone.  This framework allows for unique scripts and css on a per page basis - nice! Overall this framework has some GREAT stuff in it.  It's just maybe a little too big/rich if you just want to start building a simple site.

This brings us to Hackathon-starter. This is GREAT site to get started with and has many outstanding API integrations as well as the authentication all built out. It really lives up to it's billing.  It was easier to build up from here rather than take stuff out of Drywall.

#### Other frameworks to check out:

- [Dozer](http://dozerjs.com/)
- [Locomotive](http://locomotivejs.org/)
- [Flatiron](http://flatironjs.org/)
- API Only: [Restify](http://mcavage.me/node-restify/)

So why offer "yet another framework"?  First, I like a fully working built-out site as a starting point to "see" a framework in action. Also because I want a playground of my own **and** you might find something interesting in here!

Like what we do?
----------------
This could literally save 100's of hours of work.  If it you find it valuable I would really appreciate your support!

[Support via GITTIP](https://www.gittip.com/danstroot/)

Table of Contents
-----------------
- [Features](#features)
- [Technology](#technology)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Gulp Build System](#gulp-build-system)
- [Coding Style](#coding-style)
- [Obtaining API Keys](#obtaining-api-keys)
- [FAQ](#faq)
- [Pro Tips](#pro-tips)
- [Useful Tools](#useful-tools)
- [Interesting Design](#interesting-design)
- [Interesting Node.js Libraries](#interesting-nodejs-libraries)
- [Interesting Client-Side Libraries](#interesting-client-side-libraries)
- [Deployment](#deployment)
- [TODO](#todo)
- [Contributing](#contributing)
- [License](#license)

Features
--------
- **Modern Technology Stack**
  + Node.js
  + Node.js clusters support
  + Express.js
  + Gulp.js build system
  + Jade templates (all nicely laid out: head, navigation, footer, etc.)
  + LESS stylesheets 
  + Bootstrap 3 UI
  + FontAwesome
- **MVC project structure** (in my own style) - "Views" are the Jade Templates, "Models" are the Mongo/Mongoose models, and "Controllers" are the glue for routing, page logic and data access via the models. These should be the only things you need to touch to build out new pages and functionality.
- **Robust Authentication**
  + **Local Authentication** using Email and Password
  + **OAuth 1.0a Authentication** via Twitter
  + **OAuth 2.0 Authentication** via Facebook, Google or GitHub
- **Account Management**
  + Gravatar
  + Profile Details
  + Change Password
  + Link multiple OAuth strategies to one account
  + Delete Account
  + Password Reset
- **Administrative Pages**  
  + **Real-time** Dashboard
  + Accounts Listing
- **API Examples**: Facebook, Foursquare, Tumblr, Twitter, PayPal, etc.
- **Sample Pages**
  + Contact Form
  + Boilerplate Terms and Privacy pages. Note: **I am not a lawyer**. These have never been reviewed or even **seen** by a lawyer as far as you know. Use them only as a starting point with **your lawyer.**

Oh, and it's pretty optimized due to the Gulp build pipeline.  This is running on one drone at Nodejitsu ($9/mo!):

![Alt](https://lh3.googleusercontent.com/-8hydR9h7vs8/UwbLLLSBtPI/AAAAAAAABwA/dgpiz1Ml3Is/w850-h627-no/pagespeed.jpg)

Technology
----------

| On The Server     | On The Client  | Development |
| -------------     | -------------- | ----------- |
| Node/NPM          | Bootstrap      | Bower       |
| Express           | Font-Awesome   | Gulp        |
| Jade              | jQuery         | JSHint      |
| Mongoose          | Moment.js      | JSCS        |
| Passport          | animate.css    | Nodemon     |
| Async             | Odometer       |             |
| Modemailer        |                |             |
| Socket.io         |                |             |
| Helmet            |                |             |
| Winston           |                |             |
| express-validator |                |             |
| express-flash     |                |             |

Prerequisites
-------------

- [MongoDB](http://www.mongodb.org/downloads) - however I recommend [Mongolab](http://monglolab.com), more below about this.
- [Node.js](http://nodejs.org)
- Command Line Tools (some NPM modules must be compiled):
 - **Mac OS X**: [Xcode](https://itunes.apple.com/us/app/xcode/id497799835?mt=12) (or **OS X 10.9 Mavericks**: `xcode-select --install`)
 - **Windows**: [Visual Studio](http://www.visualstudio.com/downloads/download-visual-studio-vs#d-express-windows-8)
 - **Ubuntu**: `sudo apt-get install build-essential`
 - **Fedora**: `sudo yum groupinstall "Development Tools"`
 - **OpenSUSE**: `sudo zypper install --type pattern devel_basis`

:exclamation: **Note**: If you are new to Node.js or Express framework,
I highly recommend watching [Node.js and Express 101](http://www.youtube.com/watch?v=BN0JlMZCtNU) screencast by Alex Ford that teaches Node and Express from scratch. Alternatively, here is another great tutorial for complete beginners - [Getting Started With Node.js, Express, MongoDB](http://cwbuecheler.com/web/tutorials/2013/node-express-mongo/).

Getting Started
---------------

```bash
# Install global dependencies
npm install -g nodemon gulp

# Fetch only the latest commits.
git clone --depth=1 git@github.com:dstroot/skeleton.git
cd skeleton

# Install local dependencies
npm install
bower install

# Start everything up with Gulp 
# (builds the assets and starts the app with nodemon)
gulp
```

>:exclamation: But it probably won't really run yet! Go setup `config/config.js`. To use any of the APIs or OAuth authentication methods, you will need to obtain appropriate credentials: Client ID, Client Secret, API Key, or Username & Password. You will need to go through each provider to generate new credentials. More below.

Gulp Build System
-----------------

<a href="http://gulpjs.com">
  <img width="50" src="https://raw.github.com/gulpjs/artwork/master/gulp.png"/>
</a>

Many people use Express.js middleware to build assets, however I generally like a seperate build system like Grunt or Gulp.

Our build system compiles and minifies all assets and starts the app app using nodemon.  Nodemon will restart node every time a server .js file changes.  We also start a livereload server that will trigger a reload of your page in the browser when any client .js, .css, .jade or images change.

To take advantage of the livereload functionality install Google Chrome and then using the chrome web store install the [livereload chrome extension](https://chrome.google.com/webstore/detail/livereload/jnihajbhpnppcggbcgedagnkighmdlei). :exclamation: Click on the tiny center dot to turn on the livereload capability after you start up via `gulp`.

Now every time you make a change to a client component things will be recompiled and your browser will reload. Cool!

Coding Style
------------

A few notes on my coding style: 

- I like braces and use them always, even for single-line if statements and the like. 
- I like variable names that mean something, rather than trying to be short. 
- I favor single quotes above double quotes. 
- I use a LOT of comments, because JS can always be minified so there's really no reason to worry about comments contributing to filesize. My assumption is I will have to go change something 12 months from now and want to quickly see what is going on. 
- I use a decent amount of whitespace for the same reason. 
- I like my opening braces on the same line, not a new line.
- My eyes like alignment so I can scan down lists of things quickly (like dependencies).

This and more is pre-configured in the `.jshintrc` file.

Recommened reading: [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript)

Obtaining API Keys
------------------

#<img src="http://images.google.com/intl/en_ALL/images/srpr/logo6w.png" width="100">
- Visit [Google Cloud Console](https://cloud.google.com/console/project)
- Click **CREATE PROJECT** button
- Enter *Project Name*, then click **CREATE**
- Then select *APIs & auth* from the sidebar and click on *Credentials* tab
- Click **CREATE NEW CLIENT ID** button
 - **Application Type**: Web Application
 - **Authorized Javascript origins**: http://localhost:3000
 - **Authorized redirect URI**: http://localhost:3000/auth/google/callback
- Copy and paste *Client ID* and *Client secret* keys into `config/config.js`

:exclamation: **Note**: When you ready to deploy to production don't forget to add your new url to **Authorized Javascript origins** and **Authorized redirect URI**, e.g. `http://my-awesome-app.herokuapp.com` and `http://my-awesome-app.herokuapp.com/auth/google/callback` respectively. The same goes for other providers.

#<img src="http://www.doit.ba/img/facebook.jpg" width="100">
- Visit [Facebook Developers](https://developers.facebook.com/)
- Click **Apps > Create a New App** in the navigation bar
- Enter *Display Name*, then choose a category, then click **Create app**
- Copy and paste *App ID* and *App Secret* keys into `config/config.js`
 - *App ID* is **clientID**, *App Secret* is **clientSecret**
- Click on *Settings* on the sidebar, then click **+ Add Platform**
- Select **Website**
- Enter `http://localhost:3000` for *Site URL*

#<img src="https://github.global.ssl.fastly.net/images/modules/logos_page/GitHub-Logo.png" width="100">
- Go to [Account Settings](https://github.com/settings/profile)
- Select **Applications** from the sidebar
- Then inside **Developer applications** click on **Register new application**
- Enter *Application Name* and *Homepage URL*.
- For *Authorization Callback URL*: http://localhost:3000/auth/github/callback
- Click **Register application**
- Now copy and paste *Client ID* and *Client Secret* keys into `config/config.js`

#<img src="https://g.twimg.com/Twitter_logo_blue.png" width="50">
- Sign in at [https://dev.twitter.com](https://dev.twitter.com/)
- From the profile picture dropdown menu select **My Applications**
- Click **Create a new application**
- Enter your application name, website and description
- For **Callback URL**: http://127.0.0.1:3000/auth/twitter/callback
- Go to **Settings** tab
- Under *Application Type* select **Read and Write** access
- Check the box **Allow this application to be used to Sign in with Twitter**
- Click **Update this Twitter's applications settings**
- Copy and paste *Consumer Key* and *Consumer Secret* keys into `config/config.js`

#<img src="https://www.paypalobjects.com/webstatic/developer/logo_paypal-developer_beta.png" width="200">
- Visit [PayPal Developer](https://developer.paypal.com/)
- Log in using your existing PayPal account
- Click **Applications > Create App** in the navigation bar
- Enter *Application Name*, then click **Create app**
- Copy and paste *Client ID* and *Secret* keys into `config/config.js`
- *App ID* is **client_id**, *App Secret* is **client_secret**
- Make a note of your Sandbox accounts (test user accounts) for testing purposes.  
- Change **host** to api.paypal.com if you want to test against production and use the live credentials

#<img src="https://www.dropboxatwork.com/wp-content/uploads/2013/02/foursquare-logo.png" width="100">
- Go to [foursquare for Developers](https://developer.foursquare.com/)
- Click on **My Apps** in the top menu
- Click the **Create A New App** button
- Enter *App Name*, *Welcome page url*,
- For **Redirect URI**: http://localhost:3000/auth/foursquare/callback
- Click **Save Changes**
- Copy and paste *Client ID* and *Client Secret* keys into `config/config.js`

#<img src="http://www.athgo.org/ablog/wp-content/uploads/2013/02/tumblr_logo.png" width="100">
- Go to http://www.tumblr.com/oauth/apps
- Once signed in, click **+Register application**
- Fill in all the details
- For **Default Callback URL**: http://localhost:3000/auth/tumblr/callback
- Click **✔Register**
- Copy and paste *OAuth consumer key* and *OAuth consumer secret* keys into `config/config.js`

FAQ
---

###How do I create a new page?

You need to create just two files and edit one:

1. NEW View: In `views` create your new Jade template. For example to create a "Hello World" page you could create `views/hello/hello.jade`.
2. NEW Controller: In `controllers` you need to create a new controller to render the page when the page's route is called (`/hello`). It would look like this:

  ```js
  module.exports.controller = function(app) {
    app.get('/hello', function(req, res) {  // When user requests hello page
      res.render('hello/hello', {           // Render hello page
      });
    });
  };
  ```

3. EDIT Navigation: You need to edit the navigation to show the new page. You will need to edit `views/partials/navigation.jade` and add a list item 'li' for your new page to show it in the Navbar.

Boom!  That's it.

If you need authentication then you would add the Authentication Middleware as a dependency in your controller and then change one line of code in the controller. You will change the `apt-get` line to include the `.isAuthenticated` middleware. It always reads from left to right. A user visits `/hello` page. Then `isAuthenticated` middleware checks if you are authenticated:

```js
var passportConf  = require('../config/passport');  // New dependency

module.exports.controller = function(app) {
  app.get('/hello', passportConf.isAuthenticated, function(req, res) { // Changed
    res.render('hello/hello', {
    });
  });
};
```

The `isAuthenticated` middleware checks if you are authenticated and if not redirects you to the login page, otherwise it just calls `next` and your conroller renders the page.

```js
exports.isAuthenticated = function(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect('/login');
};
```

Express.js has `app.get`, `app.post`, `app.put`, `app.del`, but for the most part you will only use the first two. If you just want to display a page, then use `GET`, if you are submitting a form, sending a file then use `POST`.

<hr>

### Why do I keep getting `403 Error: Forbidden` on submitting a **POST** request?

You may need to add this hidden input element to your form.
```
input(type='hidden', name='_csrf', value=token)
```

###What is app_cluster.js?

From the [Node.js Documentation](http://nodejs.org/api/cluster.html#cluster_how_it_works):
> A single instance of Node runs in a single thread. To take advantage of multi-core systems
> the user will sometimes want to launch a cluster of Node processes to handle the load.
> The cluster module allows you to easily create child processes that all share server ports.

`app_cluster.js` allows you to take advantage of this feature by forking a process of `app.js`
for each CPU detected. For the majority of applications serving HTTP requests,
this is a resounding boon. However, the cluster module is still in experimental stage, therefore it should only be used after understanding its purpose and behavior. To use it, simply run `node app_cluster.js`. **Its use is entirely optional and `app.js` is not tied in any way to it**. As a reminder, if you plan to use `app_cluster.js` instead of `app.js`, be sure to indicate that in `Procfile` if you are deploying your app to Heroku.

###I am getting MongoDB Connection Error, how do I fix it?

As the message says, you need to have a MongoDB server running before launching `app.js` and a valid URL connection string in `config/config.js`.

You can get MongoDB from [mongodb.org/downloads](mongodb.org/downloads), or install it via a package manager ([Homebrew](http://brew.sh/) on Mac, **apt-get** on Ubuntu, **yum** on Fedora, etc.).

**Even Better:** Setup a free account with [Mongolab](https://mongolab.com/welcome/) and get a free database to develop with.  More below.  

###I get an error when I deploy my app, why?

Chances are you haven't changed the *Dabatase URI* in `config.js`. If `db` is set to `localhost`, it will only work on your machine as long as MongoDB is running. When you deploy to Heroku, OpenShift or some other provider, you will not have MongoDB running on `localhost`. 

You need to create an account with [MongoLab](http://mongolab.com) or [MongoHQ](http://mongohq.com), then create a free tier database. See **Deployment** section for more information on how to setup an account and a new database step-by-step with MongoLab.

###Why Jade instead of Handlebars template engine?

Subjectively speaking, Jade looks much cleaner and shorter than Handlebars, or any non-HAML style for that matter.  I like it.

### Can I use Ember, Angular or Backbone with Skeleton?

Absolutely!  But things get messy quickly.  In Drywall, several of the pages are Backbone apps.  You can check that out. 

In here we have a redimentary AJAX page (the accounts page for administrators) - that could be a good starting point.

###How do flash messages work in this project?

Flash messages allow you to display a message at the end of the request and access it on next request and only next request. For instance, on a failed login attempt, you would display an alert with some error message, but as soon as you refresh that page or visit a different page and come back to the login page, that error message will be gone. It is only displayed once.

This project uses *express-flash* module for flash messages. And that module is built on top of *connect-flash*, which is what I used in this project initially. With *express-flash* you don't have to explicity send a flash message to every view inside `res.render()`. All flash messages are available in your views via `messages` object by default, thanks to *express-flash*.

Flash messages have a two-step process. You use `req.flash('errors', { msg: 'Error messages goes here' }`
to create a flash message in your controllers, and then display them in your views.

In the first step, `'errors'` is the name of a flash message, which should match the name of the property on `messages` object in your views. You place alert messages inside `if message.errors` because you don't want to show them flash messages are actually present.

The reason why you pass an error like `{ msg: 'Error messages goes here' }` instead of just a string - `'Error messages goes here'`, is for the sake of consistency. To clarify that, *express-validator* module which is used for validating and sanitizing user's input, returns all errors as an array of objects, where each object has a `msg` property with a message why an error has occured. Here is a more general example of what express-validator returns when there are errors present:

```js
[
  { param: "name", msg: "Name is required", value: "<received input>" },
  { param: "email", msg: "A valid email is required", value: "<received input>" }
]
```

To keep consistent with that style, you should pass all flash messages
as `{ msg: 'My flash message' }` instead of a string. Otherwise you will just see an alert box without an error message. That is because, in **partials/flash.jade** template it will try to output `error.msg` (i.e. `"My flash message".msg`), in other words it will try to call a `msg` method on a *String* object,
which will return *undefined*. Everything I just mentioned about errors, also applies to "warning", "info" and "success" flash messages.

The flash messages partial template is *included* in `layout.jade`, along with footer and navigation.

```jade
doctype html
html
  include ../partials/head
  body
    include ../partials/navigation
    include ../partials/flash
    block content
    include ../partials/footer
    block scripts
```

<hr>

Pro Tips
--------
- When you install a new npm package, add a *--save* flag and it will be automatially
added to `package.json` as well. For example, `npm install --save moment`.
- Use [async.parallel()](https://github.com/caolan/async#parallel) when you neeed to run multiple asynchronous tasks, and then render a page, but only when all tasks are completed. For example, you might want to scrape 3 different websites for some data (async operation) and render the results on a page after all 3 websites have been scraped.
- Use [async.waterfall()](https://github.com/caolan/async#waterfall) when you need to run sequential tasks before you render a page.
- Need to find a specific object inside an Array? Use [_.findWhere](http://underscorejs.org/#findWhere) function from Underscore.js. For example, this is how you would retrieve a Twitter token from database: `var token = _.findWhere(req.user.tokens, { kind: 'twitter' });`, where `req.user.tokens` is an Array, and a second parameter is an object with a given key/value.

Useful Tools
------------
- [Jade Syntax Documentation by Example](http://naltatis.github.io/jade-syntax-docs/#attributes) - Even better than official Jade docs.
- [HTML to Jade converter](http://html2jade.aaron-powell.com) - Extremely valuable when you need to quickly copy and paste HTML snippets from the web.
- [JavascriptOO](http://www.javascriptoo.com/) - A directory of JavaScript libraries with examples, CDN links, statistics, and videos.
- [DailyJS](http://dailyjs.com/) - Blog about JS coding, libraries and tools.

Interesting Design
------------------
- [Bootstrap](http://getbootstrap.com/) - Start here.  ;)
- [Bootstrap Expo](http://expo.getbootstrap.com/) - Examples of Bootstrap based sites.
- [Wrap Bootstrap](https://wrapbootstrap.com/) - Bootstrap themes and templates
- [Bootswatch](http://bootswatch.com/) - Bootstrame themes (simple stuff)
- [Google Bootstrap](http://todc.github.io/todc-bootstrap/) - Google-styled theme for Bootstrap.
- [Font Awesome Icons](http://fortawesome.github.io/Font-Awesome/icons/) - It's already part of the Hackathon Starter, so use this page as a reference.
- [Colors](http://clrs.cc) - a nicer color palette for the web.
- [CSS Spinning Loaders](http://codepen.io/andymcfee/pen/ioskA) - spinning loader in CSS.
- [SpinKit](http://tobiasahlin.com/spinkit/) - 8 awesome looking spinning loaders in CSS.
- [Creative Button Styles](http://tympanus.net/Development/CreativeButtons/) - awesome button styles.
- [3D Dropdown Menu](http://soulwire.github.io/Makisu/) - CSS3 3D Dropdown Menu that folds and unfolds.
- [Creative Link Effects](http://tympanus.net/Development/CreativeLinkEffects/) - Beautiful link effects in CSS.
- [Medium Scroll Effect](http://codepen.io/andreasstorm/pen/pyjEh) - Fade in/out header background image as you scroll.
- [HTML5UP](http://html5up.net/) - Beautifully designed HTML templates.
- [Codrops](http://tympanus.net/codrops/) - Excellent design tutorials!

Interesting Node.js Libraries
-----------------------------

- [geoip-lite](https://github.com/bluesmoon/node-geoip) - get geolocation coordinates from IP address.
- [filesize.js](http://filesizejs.com/) - make file size pretty, e.g. `filesize(265318); // "265.32 kB"`.
- [Numeral.js](http://numeraljs.com) - a javascript library for formatting and manipulating numbers.

Interesting Client-Side libraries
---------------------------------
- [Hover](https://github.com/IanLunn/Hover) - Awesome css3 animations on mouse hover.
- [platform.js](https://github.com/bestiejs/platform.js) - Get client's operating system name, version, and other useful information.
- [iCheck](https://github.com/fronteed/iCheck) - Custom nice looking radio and check boxes.
- [Magnific Popup](http://dimsemenov.com/plugins/magnific-popup/) - Responsive jQuery Lightbox Plugin.
- [jQuery Raty](http://wbotelhos.com/raty/) - Star Rating Plugin.
- [Headroom.js](http://wicky.nillia.ms/headroom.js/) - Hide your header until you need it.
- [Fotorama](http://fotorama.io) - Very nice jQuery gallery.
- [X-editable](http://vitalets.github.io/x-editable/) - Edit form elements inline.
- [Offline.js](http://github.hubspot.com/offline/docs/welcome/) - Detect when user's internet connection goes offline.
- [Color Thief](https://github.com/lokesh/color-thief) - Grabs the dominant color or a representative color palette from an image.
- [select.js](http://github.hubspot.com/select/docs/welcome/) - Styleable select elements.
- [drop.js](http://github.hubspot.com/drop/docs/welcome/) -  Powerful Javascript and CSS library for creating dropdowns and other floating displays.
- [scrollReveal.js](https://github.com/julianlloyd/scrollReveal.js) - Declarative on-scroll reveal animations.

Deployment
----------

Once you are ready to deploy your app, you will need to create an account with a cloud platform to host it. These are not
the only choices, but they are my top picks. Create an account with **MongoLab** and then pick one of the 4 providers
below. Once again, there are plenty of other choices and you are not limited to just the ones listed below. From my
experience, **Heroku** is the easiest to get started with, it will automatically restart your node.js process when it crashes, custom domain support on free accounts, hot push deployments, and *Hackathon Starter* already includes `Procfile`, which is necessary for deployment to **Heroku**.

<img src="http://i.imgur.com/7KnCa5a.png" width="200">
- Open [mongolab.com](https://mongolab.com) website
- Click the yellow **Sign up** button
- Fill in your user information then hit **Create account**
- From the dashboard, click on **:zap:Create new** button
- Select **any** cloud provider (I usually go with AWS)
- Under *Plan* click on **Single-node (development)** tab and select **Sandbox** (it's free)
 - *Leave MongoDB version as is - `2.4.x`*
- Enter *Database name** for your web app
- Then click on **:zap:Create new MongoDB deployment** button
- Now, to access your database you need to create a DB user
- You should see the following message:
 - *A database user is required to connect to this database.* **Click here** *to create a new one.*
- Click the link and fill in **DB Username** and **DB Password** fields
- Finally, in `config.js` instead of `db: 'localhost'`, use the following URI with your credentials:
 - `db: 'mongodb://<dbuser>:<dbpassword>@ds027479.mongolab.com:27479/<dbname>'`

> **:exclamation:Note**: As an alternative to MongoLab, there is also [MongoHQ](http://www.mongohq.com/home).

<img src="http://blog.exadel.com/wp-content/uploads/2013/10/heroku-Logo-1.jpg" width="200">
- Download and install [Heroku Toolbelt](https://toolbelt.heroku.com/osx)
- In terminal, run `heroku login` and enter your Heroku credentials
- From *your app* directory run `heroku create`, followed by `git push heroku master`
- Done!

<img src="http://www.opencloudconf.com/images/openshift_logo.png" width="200">
- First, install this Ruby gem: `sudo gem install rhc` :gem:
- Run `rhc login` and enter your OpenShift credentials
- From *your app* directory run `rhc app create MyApp nodejs-0.10`
 - **Note**: *MyApp* is what you want to name your app (no spaces)
- Once that is done, you will be provided with **URL**, **SSH** and **Git Remote** links
- Visit that **URL** and you should see *Welcome to your Node.js application on OpenShift* page
- Copy **Git Remote** and paste it into `git remote add openshift your_git_remote`
- Before you push your app, you need to do a few modifications to your code

Add these two lines to `app.js`, just place them anywhere before `app.listen()`:
```js
var IP_ADDRESS = process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1';
var PORT = process.env.OPENSHIFT_NODEJS_PORT || 8080;
```

Then change `app.listen()` to:
```js
app.listen(PORT, IP_ADDRESS, function() {
  console.log("✔ Express server listening on port %d in %s mode", PORT, app.settings.env);
});
```
Add this to `package.json`, after *name* and *version*. This is necessary because, by default, OpenShift looks for `server.js` file. And by specifying `supervisor app.js` it will automatically restart the server when node.js process crashes.

```js
"main": "app.js",
"scripts": {
  "start": "supervisor app.js"
},
```

- Finally, now you can push your code to OpenShift by running `git push -f openshift master`
 - **Note**: The first time you run this command, you have to pass `-f` (force) flag because OpenShift creates a dummy server with the welcome page when you create a new Node.js app. Passing `-f` flag will override everything with your *Hackathon Starter* project repository. Please **do not** do `git pull` as it will create unnecessary merge conflicts.
- And you are done! (Not quite as simple as Heroku, huh?)

<img src="https://nodejs-in-production.nodejitsu.com/img/nodejitsu.png" width="200">

TODO
----
- Pages that require login, should automatically redirect to last attempted URL on successful sign-in.
- Send a welcome email for new signups.

Contributing
------------
If something is unclear, confusing, or needs to be refactored, please let me know. Pull requests are always welcome!

License
-------
The MIT License (MIT)

Copyright (c) 2014 Dan Stroot

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
