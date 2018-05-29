"use strict"
/**
 * The "HashTable" class collects the various actions needed on the mapping between terms (especially blank nodes)
 * and corresponding hash values. The various methods provide the interfaces needed by the core of the algorithm: partition,
 * fix point checking for the termination of Algorithm 1, etc.
 */

const _      = require('underscore');
const n3     = require('n3');
const n3util = n3.Util;
const assert = require('assert');

const { HashValue, hashTerm, hashTuple, hashBag } = require('./Hash');

/**
 * Mapping from terms (that may include bnode ids) to HashValues. It cannot be a simply JS Object,
 * because the order my be significant. Also, a key may have several values...
 *
 * The storage of hash value is highly redundant, to make various calculations easier and quicker. Namely
 *
 * - `_hash_values` is an array of objects each with a `hash` and `terms` key, the former a hash value, the latter an array of terms
 * - `_term_to_hash` is an object with a each term as a key, and value the corresponding hash
 * - `_bnode_to_hash` is like '_term_to_hash' except that all they keys are blank nodes
 */
class HashTable {
    constructor() {
        // Each entry is an object with "hash" and "terms" keys, the latter being an array, the former a HashValue
        // The array contains the list of terms having the hash value as hashes. For non-blank Nodes
        // this array is trivially of length one; but some of the nodes may share hash values. The goal of the
        // full algorithm is to find HashTables where this is not the case, ie, when there is a unique
        // correspondance between a hash value and a blank node.
        this._hash_values   = [];

        // Two more objects are added with redundant information; the goal is to make some subsequent
        // operations quicker. This are simple mapping from terms to hash values.
        this._term_to_hash  = {};
        this._bnode_to_hash = {};
    }

    /**
     * Set a hash value for a term
     *
     * @param term: term to be hashed
     * @param value: HashValue instance
     */
    setHash(term, hash) {
        // As a first step, term must be removed from the _hash_values, because
        // a new value will be added...
        this._hash_values = _.chain(this._hash_values)
            .map((tuple) => {
                // Remove the term if it is there
                tuple.terms = _.without(tuple.terms, term);
                if( tuple.terms.length === 0 ) {
                    return undefined;
                } else {
                    return tuple;
                }
            })
            .compact()
            .value();

        // Just store the hash values in a normal object
        this._term_to_hash[term] = hash;
        if( n3util.isBlank(term) ) this._bnode_to_hash[term] = hash;

        // Find whether that particular hash already exists, in which case the term is added,
        // otherwise just the full structure.
        let index = _.findIndex(this._hash_values, (tuple) => {
            if( HashValue.hashEqual(tuple.hash, hash) === true ) {
                if( !tuple.terms.includes(term) )
                    tuple.terms.push(term);
                return true;
            } else {
                return false;
            }
        });
        if( index === -1 ) {
            // this is a new hash value for a new terms
            this._hash_values.push({
                hash:  hash,
                terms: [term]
            })
        }
    }

    /**
     * Get a hash value for a term
     * @param term: term to find the hash for.
     */
    getHash(term) {
        return this._term_to_hash[term]
    }

    /**
     * Get terms for a specific hash
     */
    getTerms(hash) {
        for( let i = 0; i < this._hash_values.length; i++ ) {
            if( hashEqual(this._hash_values[i].hash, hash) === true ){
                return this._hash_values[i].terms
            }
        }
        return undefined;
    }

    /**
     * Get the bnode hashes
     */
    get bnode_hashes() {
        return this._bnode_to_hash;
    }

    /**
     * Clone the whole structure
     */
    clone() {
        let retval = new HashTable();
        retval._hash_values = _.map(this._hash_values, (tuple) => {
            // Fill in the redundancy data
            _.forEach(tuple.terms, (e) => {
                retval._term_to_hash[e] = tuple.hash;
                if( n3util.isBlank(e) ) retval._bnode_to_hash[e] = tuple.hash;
            });
            return {
                hash:  tuple.hash,
                terms: _.map(tuple.terms, (e) => e)
            }
        })
        return retval;
    }

    /**
     * Partition the structures: return the set of terms in a partition as described in the article
     *
     * The partition structure is an array of arrays with each constituent arrays consisting of terms with identical hash values.
     * Because this can happen with blank nodes only, the function returns only a partition of blank nodes.
     *
     * Furthermore, the returned array is ordered: first by constituent array size, then by comparing the corresponding hash values.
     */
    hashPartition() {
        let order_terms = (values) => {
            return values.sort((a,b) => {
                // First check whether the number of terms is different:
                if( a.terms.length < b.terms.length ) {
                    return -1
                }
                if( a.terms.length > b.terms.length ) {
                    return 1;
                }
                // The relationship on the hash values should settle it
                return HashValue.hashCompare(a.hash, b.hash);
            });
        };

        // create an array of tuples but only for blank nodes
        let b_hash_values =
            _.chain(this._hash_values)
            .map((tuple) => {
                // retreive the array of terms, but only keep bnodes
                let terms =
                    _.chain(tuple.terms)
                    .map((term) => n3util.isBlank(term) ? term : undefined)
                    .compact()
                    .value();
                return terms.length === 0 ? undefined : {hash: tuple.hash, terms: terms};
            })
            .compact()
            .value();

        let retval = order_terms(b_hash_values);
        return retval.map((val) => val.terms);
    }

    /**
     * Decide whether this hashtable represents a fix point in the algorithm
     *
     * The exact equation to be encoded is in line 18 of Algorithm 1: the hash table is a fix point in the iteration, if
     *   - all terms are separated, ie, they do not share a hash value (the partition is trivial); or
     *   - two terms share a hash value iff they also share a hash value in the previous iteration
     *
     * @param hprevious: the HashTable instance of the previous iteration
     * @return: boolean
     */
    isFixpoint(hprevious) {
        // Compare the blank node terms.
        // The fact of having the _bnode_to_hash object maintained separately pays off: only blank bnodes
        // may end up having shared hash values, so it is unnecessary to compare non blank node entries...
        let compare_ht = (left, right) => {
            let keys = _.keys(left._bnode_to_hash);
            for( let i = 0; i < keys.length - 1; i++ ) {
                let x = keys[i];
                for( let j = i + 1; j < keys.length; j++ ) {
                    let y = keys[j]
                    if( HashValue.hashEqual(left._bnode_to_hash[x], left._bnode_to_hash[y]) === true ) {
                        if( !HashValue.hashEqual(right._bnode_to_hash[x], right._bnode_to_hash[y]) ) {
                            return false
                        }
                    }
                }
            }
            return true;
        }
        // First see if there are trivial partitions only, ie, each hash has only one value.
        if( _.some(this._hash_values, (tuple) => tuple.terms.length !== 1) ) {
            // nop, there is at least one hash that has several terms;
            // ie, we have to test further whether it is a fixpoint nevertheless
            // by comparing the values to the previous iteration
            return compare_ht(this, hprevious) && compare_ht(hprevious, this);
        } else {
            // All entries are "trivial", ie, we are done!
            return true;
        }
    }

    /**
     * Is trivial? Ie, are all (blank node) entries trivial, meaning having a single hash for each bnode?
     *
     * @return: boolean
     */
    isTrivial() {
        return !_.some(this._hash_values, (tuple) => tuple.terms.length !== 1)
    }

    /**
     * Return list of blank node IDs ordered by their corresponding hash values.
     * This list can be used to assign canonical id-s to the blank nodes.
     *
     * @return: list of bnode identifiers
     */
    orderedBlankIDs() {
        let pairs = _.pairs(this._bnode_to_hash).sort((p1,p2) => HashValue.hashCompare(p1[1],p2[1]))
        return _.map(pairs, (p) => p[0])
    }

    /* ====================== */
    toString() {
        return JSON.stringify(this._hash_values, null, 4);
    }
}

/*
 * Structure to be used as a replacement of the hashBag function in the original paper:
 * values for each blank node are collected in an array instead of making calculations,
 * and these (hash) values are ordered increasingly and hashed as a tuple to provide
 * a final hash value. This construction avoids the hash collision that may occur with
 * the various implementations of the hashBag function that seems to lead to such
 * collisions.
 */
class HashBag {
    /**
     * Take the blank node hash values from a HashTable to initialize the Internal
     * arrays, one for each blank node.
     *
     * @param hashes: a HashTable instance
     */
    constructor(hashes) {
        this._values = _.mapObject(hashes.bnode_hashes, (val,key) => [val])
    }

    /**
     * Add a new (hash) value to be accumulated for the blank node b
     * @param b: blank node identifier
     * @param val: a hash value (instance of a HashValue class)
     */
    addValue(b, val) {
        assert.ok(this._values[b] !== undefined);
        this._values[b].push(val)
    }

    /**
     * Calculate the hash value related to the blank node 'b'. The value is calculated using the hashTuple function
     * on the accumulated values, previous ordered.
     *
     * @param b: blank node identifier
     * @return: corresponding hash value.
     */
    value(b) {
        assert.ok(this._values[b] !== undefined);
        return hashTuple(this._values[b].sort(HashValue.hashCompare))
    }

    /**
     * Get all the keys of the structure, ie, the blank node ids.
     *
     * @return: array of id-s
     */
    get keys() {
        return _.keys(this._values);
    }
}

/* =================================================================================== */

module.exports = {
    HashTable,
    HashBag
}
