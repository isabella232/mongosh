import Platform from './platform';
import os from 'os';
import { minVersion } from 'semver';

/**
 * Target enum.
 */
enum Target {
  Windows = 'win',
  MacOs = 'macos',
  Linux = 'linux'
}

/**
 * A compiler that can produce an executable that is not
 * code signable, but faster for dev environments.
 */
class UnsignableCompiler {
  sourceFile: string;
  targetFile: string;
  nodeVersion: string;

  constructor(sourceFile: string, targetFile: string, nodeVersionRange: string) {
    this.sourceFile = sourceFile;
    this.targetFile = targetFile;

    // Turn e.g. '^12.0.0' into '12' because that is the format that pkg understands
    this.nodeVersion = String(parseInt(minVersion(nodeVersionRange)));
  }

  /**
   * Compile the executable with the library.
   *
   * @param {Function} exec - The pkg compile function.
   */
  compile(exec: Function) {
    const target = this.determineTarget();
    return exec([
      this.sourceFile,
      '-o',
      this.targetFile,
      '-t',
      `node${this.nodeVersion}-${this.determineTarget()}-x64`
    ]);
  }

  /**
   * Determine the target name.
   *
   * @returns {string} The target name.
   */
  determineTarget(): string {
    switch(os.platform()) {
      case Platform.Windows: return Target.Windows;
      case Platform.MacOs: return Target.MacOs;
      default: return Target.Linux;
    }
  };
}

export default UnsignableCompiler;
