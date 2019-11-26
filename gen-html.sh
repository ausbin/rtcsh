#!/bin/bash

[[ $# -ne 1 ]] && {
    printf 'usage: %s <prod|dev>\n' "$0" >&2
    exit 1
}

html=index-proto.html
dest_html=index.html
name=$1
env=env.$name

{
    while IFS='=' read -r -a fields; do
        printf 's|\\<%s\\>|%s|g\n' "${fields[0]}" "${fields[1]}"
    done <"$env"
} | sed -f - "$html" >"$dest_html"
