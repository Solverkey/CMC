import * as migration_20261116_155520_inicial from './20261116_155520_inicial';
import * as migration_20261116_161224_web from './20261116_161224_web';
import * as migration_20261117_130500_semaforo from './20261117_130500_semaforo';
import * as migration_20261117_130600_semaforo_datos from './20261117_130600_semaforo_datos';

export const migrations = [
  {
    up: migration_20261116_155520_inicial.up,
    down: migration_20261116_155520_inicial.down,
    name: '20261116_155520_inicial',
  },
  {
    up: migration_20261116_161224_web.up,
    down: migration_20261116_161224_web.down,
    name: '20261116_161224_web',
  },
  {
    up: migration_20261117_130500_semaforo.up,
    down: migration_20261117_130500_semaforo.down,
    name: '20261117_130500_semaforo',
  },
  {
    up: migration_20261117_130600_semaforo_datos.up,
    down: migration_20261117_130600_semaforo_datos.down,
    name: '20261117_130600_semaforo_datos',
  },
];
