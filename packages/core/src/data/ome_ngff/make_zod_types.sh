#! /bin/bash

if [ "$#" -lt 2 ]; then
    echo "Error: Please provide the version number and at least one schema name." >&2
    echo "Usage: $0 version [schema1 schema2 ...]" >&2
    exit 1
fi

script_dir=$(dirname "$0")
version="$1"
schemas=( "${@:2}" )

echo "Generating zod types for OME-Zarr v${version} for schemas: ${schemas[*]}"

base_url="https://ngff.openmicroscopy.org/${version}/schemas"

generator="${script_dir}/make_zod_type.mjs"

output_dir="${script_dir}/${version}"
mkdir -p "${output_dir}"

for s in "${schemas[@]}"; do
    url="${base_url}/${s}.schema"
    class_name=$(echo "$s" | awk '{print toupper(substr($0,1,1)) substr($0,2)}')
    output_file="${output_dir}/${s}.ts"
    node "${generator}" "${url}" "${class_name}" "${output_file}"
done