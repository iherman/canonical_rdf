"use strict"
/**
 * Top level entry for the algorithm: isoCanonicalize. Internally, it performs Algorithm 3 which means using Algorithm 1 and
 * if needed, runs the recursive 'distinguish' step.
 */

const _      = require('underscore');
const n3     = require('n3');
const n3util = n3.Util;
const assert = require('assert');

const { HashValue, hashTerm, hashTuple, hashBag, HashBag }  = require('./Hash');
const { HashTable }                                         = require('./HashTable');
const { Dataset }                                           = require('./Dataset');

const debug = false;

const ALTERNATIVE_BAG = true;

/**
 *
 * First step of the algorithm: assign hash values to BNodes.
 * This is "Algorithm 1" in the paper
 *
 * @param G: a Dataset
 * @param hash: a HashTable; this parameter is optional, if not present, it will be initialized with zero values for Bnodes
 * @returns: a HashTable, the fix point of the algorithm
 */
function hashBnodes(G, hash) {
    // If the hash has not been initialized, should be done now...
    if( hash === undefined ) {
        hash = new HashTable();
        _.forEach(G.terms, (term) => {
            hash.setHash(term, n3util.isBlank(term) ? hashTerm() : hashTerm(term))
        });
    }

    let hashIm1 = null;
    let hashI   = hash
    if(debug) debugger;
    let debug_index = 0;
    let hash_bag = {};
    // Just follows the algorithmic lines in the paper, extended for quads (see also the Readme.md file of the repo)
    do {
        let c = null;
        hashIm1  = hashI.clone();
        hashI    = hashIm1.clone();
        if(ALTERNATIVE_BAG) hash_bag = new HashBag();
        _.forEach(G.quads, (quad) => {
            if( n3util.isBlank(quad.subject) ) {
                let b = quad.subject;
                if(ALTERNATIVE_BAG) {
                    hash_bag.init(b, hashI.getHash(b));
                }
                if( quad.graph ) {
                    c = hashTuple(hashIm1.getHash(quad.object), hashIm1.getHash(quad.predicate), hashIm1.getHash(quad.graph), '+')
                } else {
                    c = hashTuple(hashIm1.getHash(quad.object), hashIm1.getHash(quad.predicate), '+')
                }
                if(ALTERNATIVE_BAG) {
                    hash_bag.addValue(b, c);
                } else {
                    hashI.setHash(b, hashBag(c, hashI.getHash(b)));
                }
            }
            if( n3util.isBlank(quad.object) ) {
                let b = quad.object;
                if(ALTERNATIVE_BAG) {
                    hash_bag.init(b, hashI.getHash(b));
                }
                if( quad.graph ) {
                    c = hashTuple(hashIm1.getHash(quad.subject), hashIm1.getHash(quad.predicate), hashIm1.getHash(quad.graph), '-')
                } else {
                    c = hashTuple(hashIm1.getHash(quad.subject), hashIm1.getHash(quad.predicate), '-')
                }
                if(ALTERNATIVE_BAG) {
                    hash_bag.addValue(b, c);
                } else {
                    hashI.setHash(b, hashBag(c, hashI.getHash(b)))
                }
            }
            if( quad.graph && n3util.isBlank(quad.graph) ) {
                let b = quad.graph;
                if(ALTERNATIVE_BAG) {
                    hash_bag.init(b, hashI.getHash(b));
                }
                c = hashTuple(hashIm1.getHash(quad.subject), hashIm1.getHash(quad.predicate), hashIm1.getHash(quad.object), '.')
                if(ALTERNATIVE_BAG) {
                    hash_bag.addValue(b, c);
                } else {
                    hashI.setHash(b, hashBag(c, hashI.getHash(b)))
                }
            }
            if(ALTERNATIVE_BAG) {
                _.forEach(hash_bag.keys, (b) => hashI.setHash(b, hash_bag.value(b)));
            }
        })
    } while( !hashI.isFixpoint(hashIm1) );
    return hash;
}

/**
 *
 * Distinguish non-trivial hash values in hash partitions. This is the core of Algorithm 3 in the paper
 *
 * The implementation slightly alters the way the function is implemented, without changing the mathematics
 * 1. in the algorithm the 'P' value is ordered first. However, in calculating the hashPartition this implementation
 * does the order automatically, which makes this unnecessary as a separate step.
 *
 * 2. hashPartition generates only groups of blank nodes. This means that adding the set of blank nodes as a parameter,
 * as well as checking the blank nodes (step 11) is unnecessary.
 *
 * 3. Because the hashPartition structure is simply implemented as part of the HashTable object and is not
 * defined as a separate class, the partition is calculated at the beginning of the function on the "callee" side,
 * rather than calculated before the call on the "caller" side.
 *
 * @param G: a Dataset
 * @param hash: a Hashtable
 * @param Gmin: a Dataset
 * @returns: a (possibly new) minimal Dataset
 */
function distinguish(G, hash, Gmin) {
    // Calculate the hash partition and the index for the lowest, non-trivial entry
    let P = hash.hashPartition();
    let index = _.findIndex(P,(val) => val.length > 1);
    // If this function is called, the partition should be non-trivial...
    assert.ok(index !== -1);

    let debug_index = 0;
    _.forEach(P[index], (b) => {
        if(debug) console.log(`running distinguish: ${++debug_index}`);

        // Clone the original hash to get a fresh start for each blank node.
        // Note that this step was missing in the original, published, paper (but is done in the latest
        // copy on the author's site)
        let cloned_hash = hash.clone();

        // Distinguish the blank node that starts this cycle
        cloned_hash.setHash(b, hashTuple(hash.getHash(b),'@'));

        // Calculate a new set of hashes with this distinguished value
        let hash_prime = hashBnodes(G, cloned_hash);

        if( hash_prime.isTrivial() ) {
            // We may have found a solution if it is smaller than Gmin
            let GC = G.relabel(hash_prime.orderedBlankIDs());
            if( Gmin === undefined || Dataset.isSmaller(GC, Gmin) ) Gmin = GC;
        } else {
            // Continue the search...
            Gmin = distinguish(G, hash_prime, Gmin)
        }
    })
    return Gmin;
}


/**
 * Return an iso-canonical Graph: all bnodes are relabeled in a canonical way.
 *
 * @param G: a Dataset
 * @returns: a Dataset with canonical renames
 */
function isoCanonicalize(G) {
    // Perform the first step algorithm:
    let hash = hashBnodes(G);
    if( hash.isTrivial() ) {
        // The algorithm should stop at this point for a vast majority of graphs!
        return G.relabel(hash.orderedBlankIDs());
    } else {
        // start the recursion for a finer search
        // For debug...
        if(debug) console.log("Graph is non-trivial!");
        return distinguish(G, hash, undefined);
    }
}

module.exports = {
    isoCanonicalize
}
