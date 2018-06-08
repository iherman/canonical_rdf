#!/usr/bin/env node
"use strict";
const _             = require("underscore");
const fs            = require('fs');
const readline      = require('readline');
const program 		= require('commander');

const { HashValue, hashTerm, hashTuple, hashBag } = require('./lib/Hash');
const { HashTable }                               = require('./lib/HashTable');
const { Dataset }                                 = require('./lib/Dataset');
const { isoCanonicalize }                         = require('./lib/iso_canonical');

const test_file = "test_files/test000.nq";

function perform_test(numb, run_with_debug) {
    let base            = (numb.length === 1) ? `test00${numb}` : `test0${numb}`;
    let test_file       = `test_files/${base}.nq`;
    let test_triples    =   "";
    test_triples    = fs.readFileSync(test_file).toString();
    console.log(`>>> Test triples from ${test_file}:\n${test_triples}`);

    let graph       = new Dataset().parse(test_triples);
    let can_dataset = isoCanonicalize(graph, run_with_debug)

    console.log(`>>> Calculated triples:\n${can_dataset.toString()}`);
}

// ---------------------- See if one or more numbers have been provided on the command line:

let usage = '[-d|-c] [number]'
program
   .usage(usage)
   .option('-d --debug','run in debug mode')
   .option('-c --cycle','run in a cycle asking for test numbers')
   .parse(process.argv);

let debug = program.debug ? true : false;
let cycle = program.cycle ? true : false;

if(program.args.length === 0) {
    perform_test("0", debug);
} else {
    program.args.forEach( (val, index) => {
        perform_test(val, debug);
        if( index !== program.args.length - 1 ) console.log("\n====\n")
    })
}

// ---------------------- Cycle for additional tests
if( cycle ) {
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
            perform_test(answer, debug);
            console.log("==== Test number? ('q' to quit) ")
        }
    });
}
