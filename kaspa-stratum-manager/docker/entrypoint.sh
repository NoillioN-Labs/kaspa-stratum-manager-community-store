#!/bin/sh
set -eu

data_dir="${DATA_DIR:-/data}"
default_config="/opt/kaspa-stratum-manager/config/bridge.yaml"
runtime_config="${data_dir}/config.yaml"

mkdir -p "${data_dir}"
if [ ! -f "${runtime_config}" ]; then
  cp "${default_config}" "${runtime_config}"
fi

exec "$@"
