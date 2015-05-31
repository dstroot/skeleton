'use strict';

/**
 * Capitalize the first letter of a string
 */

exports.capitalize = function (str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

/**
 * Test JSON string validity
 */

// Use this function to see if you have a valid JSON
// string. If you pass it a json object you will see
// this error: "Unexpected token o". (?) If so try
// JSON.stringify(yourJSONobject) and pass that in.
exports.isValidJSON = function (jsonString) {
  try {
    var o = JSON.parse(jsonString);
    // Handle non-exception-throwing cases:
    // Neither JSON.parse(false) or JSON.parse(1234) throw errors, hence the type-checking,
    // but... JSON.parse(null) returns 'null', and typeof null === 'object',
    // so we must check for that too. (!)
    if (o && typeof o === 'object' && o !== null) {
      return true;
    } else {
      return false;
    }
  }
  catch (e) {
    console.log('Error: ' + e.message);
  }
  return false;
};

/**
 * Generate a random key
 */

exports.randomKey = function (len) {

  var buf = [];
  var chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  var charlen = chars.length;

  for (var i = 0; i < len; ++i) {
    buf.push(chars[getRandomInt(0, charlen - 1)]);
  }

  return buf.join('');
};

/**
 * Generate a random SMS Value
 */

exports.randomSMS = function (len) {

  var buf = [];
  var chars = '0123456789';
  var charlen = chars.length;

  for (var i = 0; i < len; ++i) {
    buf.push(chars[getRandomInt(0, charlen - 1)]);
  }

  return buf.join('');
};

/**
 * Get a random number between a min and max number
 */

function getRandomInt (min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Encode Base32
 * NOTE: Code borrowed from "thirty-two" library on NPM but is no longer maintained
 */

var charTable = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function quintetCount (buff) {
  var quintets = Math.floor(buff.length / 5);
  return buff.length % 5 === 0 ? quintets : quintets + 1;
}

exports.encode = function (plain) {
  var i = 0;
  var j = 0;
  var shiftIndex = 0;
  var digit = 0;
  var encoded = new Array(quintetCount(plain) * 8);

  while (i < plain.length) {

    /* Javascript bitwise operators:

    https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Bitwise_Operators

    <<   Bitwise Left Shift:  This operator shifts the first operand the specified number of bits to the left.
    >>   Bitwise Right Shift: This operator shifts the first operand the specified number of bits to the right.
    &    Bitwise AND:         Returns a one in each bit position for which the corresponding bits of *both* operands are ones.
    |    Bitwise OR:          Returns a one in each bit position for which the corresponding bits of *either or both* operands are ones.

    */

    var current = plain.charCodeAt(i);

    if (shiftIndex > 3) {
      digit = current & (0xff >> shiftIndex);
      shiftIndex = (shiftIndex + 5) % 8;
      digit = (digit << shiftIndex) | ((i + 1 < plain.length) ?
        plain.charCodeAt(i + 1) : 0) >> (8 - shiftIndex);
      i++;
    } else {
      digit = (current >> (8 - (shiftIndex + 5))) & 0x1f;
      shiftIndex = (shiftIndex + 5) % 8;
      if (shiftIndex === 0) {
        i++;
      }
    }

    encoded[j] = charTable[digit];
    j++;
  }

  for (i = j; i < encoded.length; i++) {
    encoded[i] = '=';
  }

  return encoded.join('');
};
