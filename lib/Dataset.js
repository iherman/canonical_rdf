#!/usr/bin/env node
"use strict";
const _      = require("underscore");
const n3     = require('n3');
const n3util = n3.Util;

const C14N   = "_:c14n_"

/**
 *
 * Just a wrapper around a list of quads as used and implemented by N3
 */
class Dataset {
    constructor(quads = []) {
        this._quads = quads;
    }

    parse(quad_string) {
        if(quad_string) {
            let parser = n3.Parser();
            this._quads = parser.parse(quad_string);
        }
        return this;
    }

    /*************************************************************************/

    get quads() {
        return this._quads;
    }

    get terms() {
        return _.chain(this._quads)
               .map((quad) => [quad.subject, quad.predicate, quad.object, quad.graph])
               .flatten()
               .compact()
               .uniq()
               .value();
    }

    /**
     * Return the quads in an array of strings representing the nquads of the dataset.
     *
     * @returns: array of strings in N-Quads syntax
     */
    get nquads() {
        let retval = "";
        const writer = n3.Writer({format: 'N-Quads'});
        this.quads.forEach( (quad) => writer.addTriple(quad) );
        writer.end( (error,result) => {
            retval = result.split('\n')
        });
        // filter out an empty string
        retval = _.filter(retval, (item) => item !== '');
        return retval;
    }

    /**
     * Return the quads in a _lexicographically ordered_ array of strings representing the nquads of the dataset.
     *
     * @returns: array of strings in N-Quads syntax
     */
    get sorted_nquads() {
        return this.nquads.sort();
    }

    /**
     * Is this graph "smaller" than the other? The definition of "smaller" is:
     *
     * G < H if and only if G ⊂ H or there exists a triple t ∈ G \ H such that no triple t' ∈ H \ G exists where t' < t .
     *
     * Where t' < t is meant in lexicographic order.
     */
    static isSmaller(G_Dataset, H_Dataset) {
        // Take the list of quads in lexicographic order:
        let G   = G_Dataset.sorted_nquads;
        let H   = H_Dataset.sorted_nquads;
        let GmH = _.difference(G, H);  // i.e. G \ H
        let HmG = _.difference(H, G);  // i.e. H \ G

        // If GmH is empty, this means G ⊂ H, ie, we are done
        if( GmH.length === 0 ) return true;

        // If HmG, i.e., H\G is empty then the second predicate is trivially true, so we are also done
        if( HmG.length === 0 ) return true;

        // We have to go through each element in GmH and see if it is smaller than all the tuples in H.
        // Because H is ordered and, as a consequence, so is HmG, the only thing we have to check is whether there is a tuple in GmH
        // that is smaller than the first entry in HmG
        return  _.some(GmH, (t) =>  t < HmG[0]);
    }

    /**
     * Get the bnode ids of the Dataset
     */
    get bnodes() {
        let retval = [];
        _.forEach(this.quads, (quad) => {
            _.forEach([quad.subject, quad.predicate, quad.object, quad.graph], (term) => {
                if( term && n3util.isBlank(term) ) retval.push(term)
            })
        })
        return _.uniq(retval);
    }

    /**
     * Return a _new_, relabeled graph. The input is an ordering of the blank node labels;
     * a canonical renaming of the original blank node labels are executed and the
     * resulting (new) Dataset is returned.
     *
     * @param bnodes: array of Bnode labels
     * @returns: a new, relabeled Dataset.
     */
    relabel(bnodes) {
        // 1. create a mapping from the original bnodes to the new ones
        let mapping = _.reduce(bnodes, (memo, bid, index) => {
            memo[bid] = `${C14N}${index}`;
            return memo;
        }, {});

        let new_quads = _.map(this.quads, (quad) => {
            let newQuad = {};
            newQuad.subject   = n3util.isBlank(quad.subject)             ? mapping[quad.subject] : quad.subject;
            newQuad.predicate = quad.predicate;
            newQuad.object    = n3util.isBlank(quad.object)              ? mapping[quad.object]  : quad.object;
            newQuad.graph     = quad.graph && n3util.isBlank(quad.graph) ? mapping[quad.graph]   : quad.graph;
            return newQuad;
        })
        return new Dataset(new_quads);
    }


    /* ================================================================================== */

    /**
     * Just for debug: print out the quads as a single string in N-Qads syntax
     */
    toString() {
        return "".concat(..._.map(this.sorted_nquads, (quad,index) => (index === this.sorted_nquads.length - 1)? quad : quad + "\n"))
    }
}

module.exports = {
    Dataset
}
