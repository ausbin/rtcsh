#!/bin/bash
set -e

npm run prodBuild
aws s3 cp index.html s3://austinjadams-com-test/wssh/
aws s3 cp bundle.js s3://austinjadams-com-test/wssh/
