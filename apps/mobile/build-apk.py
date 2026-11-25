"""Compile a local evaluation APK backed by the HTTPS installation of the Vilazuni v1 app."""
import argparse
import os
from pathlib import Path
import subprocess
from zipfile import ZIP_DEFLATED, ZipFile

source = Path(__file__).resolve().parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--out', type=Path, default=Path('dist/Vilazuni_Android.apk'))
output = (source / parser.parse_args().out).resolve()
output.parent.mkdir(parents=True, exist_ok=True)

build = source / 'android'
classes = build / 'classes'
dex = build / 'dex'
for folder in (build, classes, dex):
    folder.mkdir(parents=True, exist_ok=True)

sdk = Path(os.environ['ANDROID_HOME'])
jdk = Path(os.environ['JAVA_HOME']) / 'bin'
versions = [p for p in (sdk / 'build-tools').iterdir() if (p / 'lib/d8.jar').is_file()]
tools = max(versions, key=lambda p: tuple(int(part) for part in p.name.split('-')[0].split('.')))
platforms = (sdk / 'platforms').glob('android-*/android.jar')
platform = max(platforms, key=lambda p: int(p.parent.name.removeprefix('android-')))

def run(*args):
    # Relative paths also work in Windows accounts with accented names.
    command = [os.path.relpath(arg, source) if isinstance(arg, Path) and arg.is_absolute()
               and not arg.is_relative_to(sdk)
               and not arg.is_relative_to(jdk) else str(arg) for arg in args]
    subprocess.run(command, cwd=source, check=True)

resource = build / 'resources.zip'
unsigned = build / 'unsigned.apk'
aligned = build / 'aligned.apk'
run(tools / 'aapt2.exe', 'compile', '--dir', Path('res'), '-o', resource)
run(tools / 'aapt2.exe', 'link', '-I', platform, '--manifest', Path('AndroidManifest.xml'),
    '-o', unsigned, resource)
run(jdk / 'javac.exe', '-encoding', 'UTF-8', '--release', '8', '-classpath', platform,
    '-d', classes, Path('MainActivity.java'))
run(jdk / 'java.exe', '-cp', tools / 'lib/d8.jar', 'com.android.tools.r8.D8',
    '--min-api', '29', '--lib', platform, '--output', dex, *classes.rglob('*.class'))
with ZipFile(unsigned, 'a', ZIP_DEFLATED) as pkg:
    pkg.write(dex / 'classes.dex', 'classes.dex')
run(tools / 'zipalign.exe', '-f', '4', unsigned, aligned)
key = build / 'preview-signing.p12'
if not key.exists():
    run(jdk / 'keytool.exe', '-genkeypair', '-keystore', key, '-storetype', 'PKCS12',
        '-storepass', 'test-build-only', '-alias', 'vilazuni-local', '-keyalg', 'RSA',
        '-keysize', '2048', '-validity', '3650', '-dname', 'CN=Vilazuni build de avaliacao')
signer = tools / 'lib/apksigner.jar'
run(jdk / 'java.exe', '-jar', signer, 'sign', '--v4-signing-enabled', 'false', '--ks', key,
    '--ks-pass', 'pass:test-build-only', '--out', output, aligned)
run(jdk / 'java.exe', '-jar', signer, 'verify', '--verbose', output)
run(tools / 'aapt2.exe', 'dump', 'badging', output)
print(f'APK: {output}')
