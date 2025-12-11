#!/bin/bash
# search_replace.sh - Recursively search and replace specified patterns (case sensitive)
# Usage: Run from the root directory you want to process

# Patterns and replacements
# .dbsaicle. => .dbsaicle.
# .dbsaicle  => .dbsaicle
# "dbsaicle" => "dbsaicle"
# DBSAICLE   => DBSAICLE
# dbsaicle.  => dbsaicle.

find . -type f -exec grep -Il . {} + | while read -r file; do
    sed -i \
        -e 's/\.dbsaicle\./\.dbsaicle\./g' \
        -e 's/\.dbsaicle/\.dbsaicle/g' \
        -e 's/"dbsaicle"/"dbsaicle"/g' \
        -e 's/"dbsaicledev"/"dbsaicledev"/g' \
        -e 's/DBSAICLE/DBSAICLE/g' \
        -e 's/DbSaicle/DbSaicle/g' \
        -e 's/continue\./dbsaicle\./g' "$file"
done
