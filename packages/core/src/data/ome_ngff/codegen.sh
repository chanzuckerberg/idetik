#! /bin/zsh

version=0.5
root_dir=/tmp/ngff

git clone git@github.com:ome/ngff.git --recursive ${root_dir}

schema_dir="${root_dir}/${version}/schemas"
output_dir="./${version}"
mkdir "${output_dir}"

for i in $(ls ${schema_dir}/*.schema | grep -v strict | xargs basename | cut -d '.' -f 1); do 
    json-refs resolve --force "${schema_dir}/${i}.schema" | json-schema-to-zod -o "${output_dir}/${i}.ts" --name ${(C)i} --withJsdocs --type ${(C)i};
done