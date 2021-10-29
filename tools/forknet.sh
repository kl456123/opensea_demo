#!/bin/bash

NETWORK_URL="https://mainnet.infura.io/v3/d9054056af514990a01542c57b706abe";
GASLIMIT=10000000000000;

ganache-cli -l ${GASLIMIT} -f ${NETWORK_URL} \
  -u 0xA096b47EbF7727d01Ff4F09c34Fc6591f2c375F0 \
  -g 1000
