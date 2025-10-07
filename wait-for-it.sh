#!/bin/sh
# wait-for-it.sh - Versão final

set -e

host="$1"
shift # Consome o primeiro argumento (host:porta)

# <<< A LINHA DA VITÓRIA >>>
# O '--' é o segundo argumento. Este 'shift' o consome e o descarta.
shift 

cmd="$@"

# Extrai apenas o nome do host, sem a porta
host_name=$(echo "$host" | cut -d: -f1)

# Loop até que o host esteja pingável
until ping -c 1 "$host_name" > /dev/null 2>&1; do
  >&2 echo "Host $host_name is unavailable - sleeping"
  sleep 1
done

>&2 echo "Host $host_name is up - executing command"

# Executa o resto do comando
exec sh -c "$cmd"