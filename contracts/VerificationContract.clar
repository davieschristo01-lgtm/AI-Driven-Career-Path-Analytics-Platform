(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-PROOF-HASH u101)
(define-constant ERR-INVALID-CREDENTIAL-TYPE u102)
(define-constant ERR-INVALID-TIMESTAMP u103)
(define-constant ERR-PROOF-ALREADY-EXISTS u104)
(define-constant ERR-PROOF-NOT-FOUND u105)
(define-constant ERR-PROOF-ALREADY-VERIFIED u106)
(define-constant ERR-PROOF-REJECTED u107)
(define-constant ERR-INVALID-INSTITUTION u108)
(define-constant ERR-INSTITUTION-NOT-REGISTERED u109)
(define-constant ERR-USER-NOT-REGISTERED u110)
(define-constant ERR-INVALID-VERIFICATION-LEVEL u111)
(define-constant ERR-INVALID-EXPIRY u112)
(define-constant ERR-PROOF-EXPIRED u113)
(define-constant ERR-INVALID-SIGNATURE u114)
(define-constant ERR-MAX-PROOFS-EXCEEDED u115)
(define-constant ERR-INVALID-METADATA u116)
(define-constant ERR-REVOCATION-NOT-ALLOWED u117)
(define-constant ERR-INVALID-REVOCATION-REASON u118)
(define-constant ERR-AUTHORITY-NOT-SET u119)
(define-constant ERR-INVALID-FEE u120)

(define-data-var next-proof-id uint u0)
(define-data-var max-proofs-per-user uint u50)
(define-data-var verification-fee uint u500)
(define-data-var authority-contract (optional principal) none)

(define-map proofs
  uint
  {
    user: principal,
    proof-hash: (buff 32),
    credential-type: (string-ascii 100),
    metadata: (string-utf8 256),
    timestamp: uint,
    expiry: uint,
    verification-level: uint,
    verified: bool,
    rejected: bool,
    institution: (optional principal),
    signature: (optional (buff 65)),
    revoked: bool,
    revocation-reason: (optional (string-ascii 100)),
    revocation-timestamp: (optional uint)
  }
)

(define-map proofs-by-hash
  (buff 32)
  uint
)

(define-map institutions
  principal
  {
    name: (string-ascii 100),
    registered-at: uint,
    active: bool
  }
)

(define-map users
  principal
  {
    registered-at: uint,
    proof-count: uint
  }
)

(define-read-only (get-proof (id uint))
  (map-get? proofs id)
)

(define-read-only (get-proof-by-hash (hash (buff 32)))
  (let ((id (map-get? proofs-by-hash hash)))
    (match id proof-id (get-proof proof-id) none)
  )
)

(define-read-only (get-institution (inst principal))
  (map-get? institutions inst)
)

(define-read-only (get-user (usr principal))
  (map-get? users usr)
)

(define-read-only (is-proof-verified (id uint))
  (match (get-proof id)
    p (and (get verified p) (not (get rejected p)) (not (get revoked p)) (>= (get expiry p) block-height))
    false
  )
)

(define-private (validate-proof-hash (hash (buff 32)))
  (if (is-eq (len hash) u32)
    (ok true)
    (err ERR-INVALID-PROOF-HASH)
  )
)

(define-private (validate-credential-type (typ (string-ascii 100)))
  (if (and (> (len typ) u0) (<= (len typ) u100))
    (ok true)
    (err ERR-INVALID-CREDENTIAL-TYPE)
  )
)

(define-private (validate-metadata (meta (string-utf8 256)))
  (if (<= (len meta) u256)
    (ok true)
    (err ERR-INVALID-METADATA)
  )
)

(define-private (validate-timestamp (ts uint))
  (if (>= ts block-height)
    (ok true)
    (err ERR-INVALID-TIMESTAMP)
  )
)

(define-private (validate-expiry (exp uint))
  (if (> exp block-height)
    (ok true)
    (err ERR-INVALID-EXPIRY)
  )
)

(define-private (validate-verification-level (level uint))
  (if (and (>= level u1) (<= level u5))
    (ok true)
    (err ERR-INVALID-VERIFICATION-LEVEL)
  )
)

(define-private (validate-signature (sig (buff 65)))
  (if (is-eq (len sig) u65)
    (ok true)
    (err ERR-INVALID-SIGNATURE)
  )
)

(define-private (validate-revocation-reason (reason (string-ascii 100)))
  (if (<= (len reason) u100)
    (ok true)
    (err ERR-INVALID-REVOCATION-REASON)
  )
)

(define-private (validate-institution (inst principal))
  (match (map-get? institutions inst)
    i (if (get active i) (ok true) (err ERR-INSTITUTION-NOT-REGISTERED))
    (err ERR-INSTITUTION-NOT-REGISTERED)
  )
)

(define-private (validate-user (usr principal))
  (match (map-get? users usr)
    u (ok true)
    (err ERR-USER-NOT-REGISTERED)
  )
)

(define-public (set-authority-contract (contract-principal principal))
  (begin
    (asserts! (is-none (var-get authority-contract)) (err ERR-AUTHORITY-NOT-SET))
    (var-set authority-contract (some contract-principal))
    (ok true)
  )
)

(define-public (set-max-proofs-per-user (new-max uint))
  (begin
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-SET))
    (asserts! (> new-max u0) (err ERR-INVALID-FEE))
    (var-set max-proofs-per-user new-max)
    (ok true)
  )
)

(define-public (set-verification-fee (new-fee uint))
  (begin
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-SET))
    (var-set verification-fee new-fee)
    (ok true)
  )
)

(define-public (register-institution (name (string-ascii 100)))
  (begin
    (asserts! (is-none (map-get? institutions tx-sender)) (err ERR-INSTITUTION-NOT-REGISTERED))
    (asserts! (> (len name) u0) (err ERR-INVALID-CREDENTIAL-TYPE))
    (map-set institutions tx-sender { name: name, registered-at: block-height, active: true })
    (ok true)
  )
)

(define-public (register-user)
  (begin
    (asserts! (is-none (map-get? users tx-sender)) (err ERR-USER-NOT-REGISTERED))
    (map-set users tx-sender { registered-at: block-height, proof-count: u0 })
    (ok true)
  )
)

(define-public (submit-proof (proof-hash (buff 32)) (credential-type (string-ascii 100)) (metadata (string-utf8 256)) (expiry uint) (verification-level uint))
  (let (
    (next-id (var-get next-proof-id))
    (user-data (unwrap! (map-get? users tx-sender) (err ERR-USER-NOT-REGISTERED)))
    (authority (unwrap! (var-get authority-contract) (err ERR-AUTHORITY-NOT-SET)))
  )
    (try! (validate-proof-hash proof-hash))
    (try! (validate-credential-type credential-type))
    (try! (validate-metadata metadata))
    (try! (validate-expiry expiry))
    (try! (validate-verification-level verification-level))
    (asserts! (is-none (map-get? proofs-by-hash proof-hash)) (err ERR-PROOF-ALREADY-EXISTS))
    (asserts! (< (get proof-count user-data) (var-get max-proofs-per-user)) (err ERR-MAX-PROOFS-EXCEEDED))
    (try! (stx-transfer? (var-get verification-fee) tx-sender authority))
    (map-set proofs next-id
      {
        user: tx-sender,
        proof-hash: proof-hash,
        credential-type: credential-type,
        metadata: metadata,
        timestamp: block-height,
        expiry: expiry,
        verification-level: verification-level,
        verified: false,
        rejected: false,
        institution: none,
        signature: none,
        revoked: false,
        revocation-reason: none,
        revocation-timestamp: none
      }
    )
    (map-set proofs-by-hash proof-hash next-id)
    (map-set users tx-sender { registered-at: (get registered-at user-data), proof-count: (+ (get proof-count user-data) u1) })
    (var-set next-proof-id (+ next-id u1))
    (print { event: "proof-submitted", id: next-id, user: tx-sender })
    (ok next-id)
  )
)

(define-public (verify-proof (id uint) (signature (buff 65)))
  (let ((proof (unwrap! (map-get? proofs id) (err ERR-PROOF-NOT-FOUND))))
    (try! (validate-institution tx-sender))
    (try! (validate-signature signature))
    (asserts! (not (get verified proof)) (err ERR-PROOF-ALREADY-VERIFIED))
    (asserts! (not (get rejected proof)) (err ERR-PROOF-REJECTED))
    (asserts! (< block-height (get expiry proof)) (err ERR-PROOF-EXPIRED))
    (map-set proofs id
      (merge proof
        {
          verified: true,
          institution: (some tx-sender),
          signature: (some signature)
        }
      )
    )
    (print { event: "proof-verified", id: id, institution: tx-sender })
    (ok true)
  )
)

(define-public (reject-proof (id uint))
  (let ((proof (unwrap! (map-get? proofs id) (err ERR-PROOF-NOT-FOUND))))
    (try! (validate-institution tx-sender))
    (asserts! (not (get verified proof)) (err ERR-PROOF-ALREADY-VERIFIED))
    (asserts! (not (get rejected proof)) (err ERR-PROOF-REJECTED))
    (map-set proofs id (merge proof { rejected: true }))
    (print { event: "proof-rejected", id: id, institution: tx-sender })
    (ok true)
  )
)

(define-public (revoke-proof (id uint) (reason (string-ascii 100)))
  (let ((proof (unwrap! (map-get? proofs id) (err ERR-PROOF-NOT-FOUND))))
    (asserts! (is-eq (get user proof) tx-sender) (err ERR-REVOCATION-NOT-ALLOWED))
    (try! (validate-revocation-reason reason))
    (asserts! (get verified proof) (err ERR-PROOF-NOT-FOUND))
    (asserts! (not (get revoked proof)) (err ERR-PROOF-REJECTED))
    (map-set proofs id
      (merge proof
        {
          revoked: true,
          revocation-reason: (some reason),
          revocation-timestamp: (some block-height)
        }
      )
    )
    (print { event: "proof-revoked", id: id, user: tx-sender, reason: reason })
    (ok true)
  )
)