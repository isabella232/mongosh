import tar from 'tar';
import path from 'path';
import AdmZip from 'adm-zip';
import pkgDeb from 'pkg-deb';
import pkgRpm from 'pkg-rpm';
import BuildVariant from './build-variant';

/**
 * Get the path to the tarball.
 *
 * @param {string} outputDir - The output directory.
 * @param {string} build variant - The Build Variant.
 * @param {string} version - The version.
 *
 * @returns {string} The path.
 */
export const tarballPath = (outputDir: string, buildVariant: string, version: string): string => {
  if (buildVariant === BuildVariant.Linux) {
    return path.join(outputDir, `mongosh-${version}-${buildVariant}.tgz`);
  } else if (buildVariant === BuildVariant.Redhat) {
    return path.join(outputDir, `mongosh-${version}-x86_64.rpm`);
  } else if (buildVariant === BuildVariant.Debian) {
    // debian packages are required to be separated by _ and have arch in the
    // name: https://www.debian.org/doc/manuals/debian-faq/pkg-basics.en.html
    // sometimes there is also revision number, but we can add that later.
    return path.join(outputDir, `mongosh_${version}_amd64.deb`);
  }
  return path.join(outputDir, `mongosh-${version}-${buildVariant}.zip`);
};

/**
 * Filter out the archive itself when creating the tarball.
 *
 * @param {string} path - The path.
 *
 * @returns {boolean} If the file should be filtered out.
 */
const filterOut = (pathToFilter: string): boolean => {
  return !pathToFilter.match(/tgz/g);
};

/**
 * Create a tarball archive for posix.
 *
 * @param {string} outputDir - The output directory.
 * @param {string} filename - the tarball filename.
 */
export const tarballPosix = async(outputDir: string, filename: string): Promise<void> => {
  const options = { gzip: true, file: filename, cwd: outputDir, filter: filterOut };
  await tar.c(options, [ '.' ]);
};

/**
 * Create a tarball archive for debian.
 *
 * @param {string} input - The mongosh binary.
 * @param {string} outputDir - The directory to write the tarball.
 * @param {string} version - The current version.
 * @param {string} rootDir - The root directory of this project.
 */
export const tarballDebian = async(
  input: string,
  outputDir: string,
  version: string,
  rootDir: string
): Promise<void> => {
  const options = {
    version: version,
    name: 'mongosh',
    dest: outputDir,
    src: rootDir, // pkg-deb will look for package.json in src to get info
    input: input,
    // for debugging pkgDeb, uncomment the next line:
    // loggger: console.info,
    arch: 'amd64' // this might need to be 'all'
  };

  console.info('mongosh: writing debian package');
  await pkgDeb(options);
};


/**
 * Create a tarball archive for redhat.
 *
 * @param {string} input - The mongosh binary.
 * @param {string} outputDir - The directory to write the tarball.
 * @param {string} version - The current version.
 * @param {string} rootDir - The root directory of this project.
 */
export const tarballRedhat = async(
  input: string,
  outputDir: string,
  version: string,
  rootDir: string
): Promise<void> => {
  const options = {
    version: version,
    name: 'mongosh',
    dest: outputDir,
    src: rootDir,
    input: input,
    arch: 'x86_64'
  };

  console.info('mongosh: writing redhat package');
  await pkgRpm(options);
};

/**
 * Create a tarball archive for windows.
 *
 * @param {string} input - The file to tarball.
 * @param {string} filename - the tarball filename.
 */
export const tarballWindows = (input: string, filename: string): void => {
  const admZip = new AdmZip();
  admZip.addLocalFile(input);
  admZip.writeZip(filename);
};

export type TarballFile = { path: string; contentType: string };

/**
 * Create a gzipped tarball or zip for the provided options.
 *
 * @param {string} input - The file location to tarball.
 * @param {string} outputDir - Where to save the tarball.
 * @param {string} buildVariant- The build variant.
 * @param {string} version - The version.
 *
 * @returns {TarballFile} The path and type of the tarball.
 */
export async function createTarball(
  input: string,
  outputDir: string,
  buildVariant: string,
  version: string,
  rootDir: string
): Promise<TarballFile> {
  const filename = tarballPath(outputDir, buildVariant, version);

  console.info('mongosh: gzipping:', filename);

  if (buildVariant === BuildVariant.Linux) {
    await tarballPosix(outputDir, filename);

    return {
      path: filename,
      contentType: 'application/gzip'
    };
  } else if (buildVariant === BuildVariant.Redhat) {
    await tarballRedhat(input, outputDir, version, rootDir);

    return {
      path: filename,
      contentType: 'application/x-rpm'
    };
  } else if (buildVariant === BuildVariant.Debian) {
    await tarballDebian(input, outputDir, version, rootDir);

    return {
      path: filename,
      contentType: 'application/vnd.debian.binary-package'
    };
  }
  tarballWindows(input, filename);

  return {
    path: filename,
    contentType: 'application/zip'
  };
}
