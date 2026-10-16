#!/bin/sh
# Throwaway CA + leaf (SAN camp.local, localhost, 127.0.0.1) for the TLS test. Written to .certs/ (gitignored).
# Nothing is installed into any trust store; the test trusts the leaf by SPKI pin via a Chromium flag.
set -e
cd "$(dirname "$0")" && mkdir -p .certs && cd .certs
cat > openssl.cnf <<'CNF'
[req]
distinguished_name = dn
prompt = no
[dn]
CN = Moonveil spike CA (throwaway)
[ca_ext]
basicConstraints = critical, CA:TRUE, pathlen:0
keyUsage = critical, keyCertSign, cRLSign
subjectKeyIdentifier = hash
[leaf_ext]
basicConstraints = CA:FALSE
keyUsage = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = DNS:camp.local, DNS:localhost, IP:127.0.0.1
CNF
openssl ecparam -name prime256v1 -genkey -noout -out ca.key
openssl req -new -x509 -sha256 -key ca.key -out ca.crt -days 30 -config openssl.cnf -extensions ca_ext
openssl ecparam -name prime256v1 -genkey -noout -out leaf.key
openssl req -new -key leaf.key -out leaf.csr -subj '/CN=camp.local'
openssl x509 -req -sha256 -in leaf.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out leaf.crt -days 30 -extfile openssl.cnf -extensions leaf_ext
openssl x509 -in leaf.crt -pubkey -noout | openssl pkey -pubin -outform der | openssl dgst -sha256 -binary | openssl base64 > leaf.spki
echo "leaf SPKI: $(cat leaf.spki)"
