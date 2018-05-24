# Proof-of-concept implementation of Aidan Hogan’s iso-canonical algorithm for RDF graph canonicalization

[Aidan Hogan](http://aidanhogan.com/) has published two papers on one of the fundamental building blocks for the RDF infrastructure: calculating a canonical RDF graph. A canonical graph allows, for example, to sign an RDF graph, needed for various security, consistency, provenance, etc., considerations in applications like verifiable claims, usage of linked data on block chain, consistency proof for ontologies, publication of data, etc. The two papers are:

1. A. Hogan, “Skolemising Blank Nodes while Preserving Isomorphism,”, WWW2015 conference proceedings, 2015, pp. 430–440. [See PDF version](http://www.www2015.it/documents/proceedings/proceedings/p430.pdf).
2. A. Hogan, “Canonical Forms for Isomorphic and Equivalent RDF Graphs: Algorithms for Leaning and Labelling Blank Nodes,” ACM Trans. Web, vol. 11, no. 4, pp. 22:1–22:62, Jul. 2017. [See PDF version](http://aidanhogan.com/docs/rdf-canonicalisation.pdf).

(The second paper supersedes the first insofar that it slightly simplifies the relevant algorithm, although it also contains much more than what is relevant for this repository. Note also that the URL above for the second paper refers to the author’s copy on his Web site, which takes care of some minor bugs that surfaced since the publication. That version was used for this implementation.)

This repository contains a proof-of-concept implementation in node.js of what is referred to as the “iso-canonical algorithm” described in the papers, using the N3.js library for the representation of quads. It is fully based on Aidan’s algorithm, except for one tiny extension: while Aidan describes the canonicalization of RDF _graphs_, this implementations deals with RDF _datasets_ (a.k.a. named graphs). The description of the changes are described [below](#datasets).

The reason for doing this implementation was to explore whether it is possible to define a stable specification (e.g., W3C Recommendation) on the subject starting with Aidan’s algorithm and, if yes, what is missing in terms of a specification (see [the separate section below](#spec) for more details of those). The implementation does not aim, or pretend, to be of a production quality, it has not been profiled for speed, etc. It shows, however, that the algorithm _can_ be implemented without any further mathematical work based solely on the paper. I.e., Aidan’s algorithm is indeed one of the viable approaches if such a specification is to be produced.

(Note that Aidan does have an implementation of his own algorithm in Java, which is also on GitHub. This Javascript implementation is completely independent of that one.)

## What is meant by “Canonical RDF Graph/Dataset”?

A matter of terminology: in this paper (and this implementation) a canonical version _can(G)_ of the Graph/Dataset _G_ is isomorphic to _G_ (i.e., _can(G)≅G_), and if _H≅G_ then _can(H)=can (G)_. In other words, it is an isomorphic graph where the blank node renaming bijection, characterizing the isomorphism, is _deterministic_.

## [Adaptation of the algorithms to handle datasets](id:datasets)

The changes/additions are as follows (each of those changes are relevant only if there _is_ a separate graph identifier, i.e., if we have a quad instead of a triple. If this is not the case, the algorithm falls back to the original).

1. In algorithm 1, at step 13 and 16, respectively: the _hashTuple_ function gets a fourth argument, before the '+' and '-' characters, respectively, referring to the hash value of the graph identifier;
2. In algorithm 1, after step 17, a similar branch is added for the case of a _(s,p,p,b)_ quad (i.e., if the graph identifier is a blank node); the _hashTuple_ in that branch hashes the full _(s,p,o)_ triple, plus the '.' character.
3. The lexicographic comparison of quads for, e.g., comparing graphs/datasets, take into account the possible graph id, too.

## [Further details that should be provided for a specification](id:spec)

The article defines and proves the mathematical algorithm; however, for a precise specification, some further details must be properly specified to ensure interoperable implementations. This is not a shortcoming of the paper; it only means that some of the functions, details, etc., that are only characterized by their behavior, should have a more precise definition.

Each entry below describes what has to be specified, and also how this particular implementation implements it. The choice of this implementation may be arbitrary, and should not be considered as binding by any means.

### Additional steps to be defined beyond the canonicalization

Aidan’s algorithm specifies _can(G)_, i.e., the deterministic mapping of the blank nodes in the Graph/Dataset. A full specification for signing RDF Datasets would also include some fairly routine engineering steps:

- Define the _hash_ of an RDF Dataset _G_. One approach could be to generate the [Canonical N-Quads representation](#canq) of _can(G)_, lexicographically order it, and calculate the hash of ordered quads. Another possibility would be to hash each individual triples/quads of _can(G)_ separately, and then use the _`hashBag`_ function (see [below](#hashbag)), applied to all the hashes, to generate the hash of the Graph/Dataset.
- Define the _signature_ of _G_. The usual approach is to encrypt, by some standard means, the hash of _G_.
- Define a standard vocabulary for adding the metadata of the signature to the result (public key, hash function used, etc.). An adaptation of the [XML Signature](https://www.w3.org/TR/xmldsig-core/) specification would probably suffice.

### Which hash function to use?

The paper does not specify which hash function to use, just that it should be a perfect one. It also contains some measurements and calculation on which functions are worth using.

_This implementation uses md4._ The only reason is that the resulting values are relatively short which makes it easier to debug. A final specification should probably use SHA256. (Note that the article refers to SHA128 as being probably enough; however, the OpenSSL library, at least as used in node.js, does not seem to offer this function hence the choice for SAH256 as being probably more widely deployed.) The `crypto` package in node.js (and, consequently, this implementation) stores the values of hashes as a `Buffer` instance of unsigned 8 bit integers; the number of such integers depend on the specific hash function used.

### What does a "0" value of a hash mean?

The hash tables are initialized by setting a '0' as a hash value for each blank node. It must be defined exactly what this means (depending on how hashes are represented): a number or a hexadecimal representation thereof.

_This implementation uses a Buffer with all zero entries._ Essentially, this is a zero number.

### What does comparing hash values mean?

There may be several choices: comparing the values as (large) numbers, lexicographically compare the values' hexadecimal representations,…

_This implementation uses the `compare` function of `Buffer` in node.js for the representation of a hash._ This corresponds (I believe) to the comparison of the values as large numbers.

### What is the precise specification of `hashTuple`?

The article says:

>“_hashTuple(·)_ will compute an order-dependent hash of its inputs”

_This implementation uses the OpenSSL (i.e., `node.js`’s `crypto` package) facility to add new values before generating the digest_. I am not sure what this means _exactly_ specification-wise but, probably, a concatenation of the values or `Buffer` instances before generating the digest.

### [What is the precise specification of `hashBag`?](id:hashbag)

The article says:

> “The function _hashBag(·)_ computes hashes in a commutative and associative way over its inputs.”

_This implementation uses a module 255 sum of the `Buffer` entries in the `node.js` representations of the hashes._

### What is the precise comparison method of graphs?

The algorithm is based on the ability to have a total ordering of graphs/datasets; indeed, the more complex step is based on calculating a minimum of the candidate graphs/datasets.

_This implementation uses the example definition as provided in the paper:_

> G < H if and only if G ⊂ H or there exists a triple t ∈ G \ H such that no triple t' ∈ H \ G exists where t' < t”

where the comparison of quad is made comparing the lexicographic representation of the tuples, represented as N-Quads.

### [Canonical N-Quads](id:canq)

Though the article does not refer to this, a final specification should probably include the specification of “canonical” N-Quads if N-Quads are used in the various steps. This “canonical” N-Quads should specify, for example, that no comments are allowed, no empty lines are allowed, what EOL characters are to be used, that all white spaces between terms are reduced to one, whether there is a white space before the trailing "." character of a triple or not, etc.
