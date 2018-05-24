#!/usr/bin/env node
"use strict";
const _             = require("underscore");
const fs            = require('fs');
const readline      = require('readline');
const debug         = true;

const { HashValue, hashTerm, hashTuple, hashBag } = require('./lib/Hash');
const { HashTable }                               = require('./lib/HashTable');
const { Dataset }                                 = require('./lib/Dataset');
const { isoCanonicalize }                         = require('./lib/iso_canonical');


function perform_test(test_file) {
    let test_triples    =   "";
    test_triples    = fs.readFileSync(test_file).toString();
    console.log(`>>> Test triples from ${test_file}:\n${test_triples}`);

    let graph       = new Dataset().parse(test_triples);
    let can_dataset = isoCanonicalize(graph)

    console.log(`>>> Calculated triples:\n${can_dataset.toString()}`);
}

if(process.argv.length < 3) {
    console.log('Usage: [node] main.js fname');
} else {
    perform_test(process.argv[2])
}
