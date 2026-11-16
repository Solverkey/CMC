import * as migration_20261116_155520_inicial from './20261116_155520_inicial';

export const migrations = [
  {
    up: migration_20261116_155520_inicial.up,
    down: migration_20261116_155520_inicial.down,
    name: '20261116_155520_inicial'
  },
];
