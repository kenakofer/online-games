#!/bin/bash

replace_on="COLORTEMPLATE"

typeset -A color_names
color_names=(
    [blue]="rgb(50,100,255)"
    [yellow]="rgb(255,220,0)"
    [green]="rgb(50,230,100)"
    [red]="rgb(255,50,50)"
    [white]="rgb(220,220,220)"
    [black]="rgb(60,60,60)"
    );

for f in ./*.png; do
    if [[ $f == *"$replace_on"* ]]; then
        for color_name in "${!color_names[@]}"; do
            color_value="${color_names[$color_name]}"
            newf="${f/$replace_on/$color_name}"
            echo "convert $f -colorspace gray -channel RGB +level-colors ,\"$color_value\" $newf"
            convert $f -colorspace gray -channel RGB +level-colors ,"$color_value" $newf
        done
    fi
done

