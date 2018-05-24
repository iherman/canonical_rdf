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

const test_file = "test_files/test000.nq";

function perform_test(numb) {
    let base            = (numb.length === 1) ? `test00${numb}` : `test0${numb}`;
    let test_file       = `test_files/${base}.nq`;
    let test_triples    =   "";
    test_triples    = fs.readFileSync(test_file).toString();
    console.log(`>>> Test triples from ${test_file}:\n${test_triples}`);

    let graph       = new Dataset().parse(test_triples);
    let can_dataset = isoCanonicalize(graph)

    console.log(`>>> Calculated triples:\n${can_dataset.toString()}`);

}

// ---------------------- See if one or more numbers have been provided on the command line:

if( process.argv.length === 2 ) {
    perform_test("0");
} else {
    process.argv.forEach( (val, index) => {
        if( index > 1 ) {
            perform_test(val);
            if( index !== process.argv.length - 1 ) console.log("====")
        }
    })
}



// ---------------------- Cycle for additional tests
if( !debug ) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    console.log("==== Test number? ('q' to quit) ")
    rl.on('line', (answer) => {
        if(answer === 'q') {
            console.log('to quit');
            rl.close();
            process.exit(0)
        } else {
            perform_test(answer);
            console.log("==== Test number? ('q' to quit) ")
        }
    });
}
