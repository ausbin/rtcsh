websocket sh
============

try it: <https://ausb.in/wssh/>. open a few instances to see the magic

getting started
---------------

### frontend

    $ npm install
    $ npm run build

### backend

    $ cd wsshd
    $ go get
    $ go build
    $ ./wsshd -static-path ..
