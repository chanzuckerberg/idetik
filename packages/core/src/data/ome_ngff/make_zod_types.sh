#! /bin/zsh

version=0.4
root_dir=/tmp/ngff

if [ ! -d "${root_dir}" ]; then
    echo "Cloning OME-NGFF repository..."
    git clone git@github.com:ome/ngff.git --recursive ${root_dir}
else
    echo "Using existing OME-NGFF repository at ${root_dir}."
fi

schema_dir="${root_dir}/${version}/schemas"
output_dir="./${version}"
mkdir -p "${output_dir}"

for i in $(ls ${schema_dir}/*.schema | grep -v strict | xargs basename | cut -d '.' -f 1); do 
    echo "Processing schema: ${schema_dir}/${i}.schema"
    node resolve_schema.cjs "${schema_dir}/${i}.schema" | json-schema-to-zod -o "${output_dir}/${i}.ts" --name ${(C)i} --withJsdocs --type ${(C)i};
done