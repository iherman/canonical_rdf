"use strict"
/**
 * Hashing related functions needed by the Hogan algorithm for canonicalization. It provides a wrapper around
 * the node.js crypto package's hash function, making use of the fact that the "digest" method of hashing
 * returns a Buffer instance (ie, some sort of an array of binary 8-bit unsigned integers).
 */

const crypto = require('crypto');
const assert = require('assert');

/**
 * Hash function to use
 */
const SHA = 'md5';

/**
 * All buffers have the same length, depending on the exact SH module. To be calculated once...
 */
const sh_length = crypto.createHash(SHA).update('whatever').digest().length;

/**
 * Wrapper around the Buffer that the crypto hash functions produce as digests.
 *
 * The reason it is necessary is because the algorithms are defined in terms of numbers, mainly for the purpose
 * of the 'hashBag' function below. Although it would be possible to do all operations on hex strings (ie, hex encoding of the digest),
 * that function would be much more complicated, and I tried to stay as close to Aidan's article as possible.
 *
 * Instances of HashValue-s are the only structures the outside world ought to see.
 */
class HashValue {
    /**
     * A new has value can be produced by essentially cloning another one, or as a result of the
     * crypto package calcualtion, ending up in a Buffer.
     */
    constructor(buffer) {
        this._value = buffer instanceof HashValue ? buffer.value : buffer
    }

    /**
     * Get access to the buffer. In fact, this is only used by the function in this module, is not really necessary to have it in
     * general... (I am not sure whether it is possible to restrict the visibility of this function to the module in Javascript...)
     */
    get value() {
        return this._value;
    }

    /**
     * Get the hex version of the value. This may be used for debug but, maybe, for indexing into other objects...
     */
    get hex() {
        return this._value.reduce( (result, value) => {
            let n = value.toString(16);
            return result + (value <= 16 ? `0${n}` : n);
        }, "")
    }

    /**
     * Clone a HashValue
     */
    clone() {
        return new HashValue(this._value);
    }

    /**
     * Comparison function to compare HashValues, in a format that can be used for sorting of arrays. It is a wrapper around
     * the compare method of Buffer.
     *
     * @param h1: a HashValue instance
     * @param h2: a HashValue instance
     * @returns -1, 0, 1, depending on whether h1 < h2, h1 = h2, h1 > h2, respectively
     */
    static hashCompare(h1, h2) {
        return Buffer.compare(h1.value, h2.value);
    }

    /**
     * Shorthand for equality, falls back on the hashCompare function.
     * @param h1: a HashValue instance
     * @param h2: a HashValue instance
     * @returns boolean
     */
    static hashEqual(h1,h2) {
        return HashValue.hashCompare(h1,h2) === 0;
    }

    /**
     * Just for debugging...
     */
    toJSON() {
        return this.hex
    }
}


/**
 * Hash a term. This is used as a starting values for the hashings, essentially hashing the various terms or their tuples.
 *
 * If no data is given, the hash value of zero is used. This is the initial value of blank node hashes in the algorithm
 * @param data: term that can be hashed: string or buffer
 * @returns a HashValue instance
 */
function hashTerm(data) {
    return (data === undefined) ? new HashValue(Buffer.alloc(sh_length)) : new HashValue(crypto.createHash(SHA).update(data).digest());
}


/**
 * Hash a tuple of terms or already existing hashes. Order counts.
 * This also falls back on the core crypto call.
 *
 * NOTE: a spec should clearly specify the details of this function. In this case the corresponding buffers (representing the hash values)
 * simply concatenated, but that is an arbitrary choice at this point.
 *
 * @param data: a tuple of any data that can be hashed: string or a previous hash value.
 * @returns a HashValue instance
 */
function hashTuple(...data) {
    let buffers = data.map((d) => {
        return d instanceof HashValue === true ? d.value : Buffer.from(d);
    });
    let retval = hashTerm(Buffer.concat(buffers));
    return retval;
}


/**
 * Hashes two hash values, and this must be associative and commutative per the algorithm. The sum, modulo 255, of
 * each entry un the hash value's bytes (as stored in the Buffer) are calculated.
 *
 * I am not 100% this is perfectly fine, but using this for now.
 *
 * NOTE: a spec should clearly specify the details of this function.
 *
 * @param h1: a HashValue instance
 * @param h2: a HashValue instance
 * @returns a HashValue instance
 */
function hashBag(h1, h2) {
    let result = h1.value.map((val,index) => (val + h2.value[index]) % 255);
    return new HashValue(Buffer.from(result));
}


class HashBag {
    constructor() {
        this._values = {};
    }

    /**
     * Init a new (hash) value to be accumulated for the blank node b.
     * @param b: blank node identifier
     * @param val: a hash value (instance of a HashValue class)
     */
    init(b, val) {
        if(this._values[b] === undefined) {
            this._values[b] = [val];
        }
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

    get keys() {
        return Object.keys(this._values);
    }
}

/* =================================================================================== */

module.exports = {
    HashValue,
    hashTerm,
    hashTuple,
    hashBag,
    HashBag
}
