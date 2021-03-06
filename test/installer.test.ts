import * as chai from 'chai';
import * as fs from 'mz/fs';
import * as io from '@actions/io/lib/io';
import * as ioUtil from '@actions/io/lib/io-util';
import * as path from 'path';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
import * as tc from '@actions/tool-cache';
import * as validUrl from 'valid-url';
import { Installer } from '../src/installer';
import { Command } from '../src/command';

const expect = chai.expect;
chai.use(sinonChai);

/* global suite, setup, teardown, test */
/* eslint no-undef: "error" */

suite('Installer', () => {
    let sandbox: sinon.SinonSandbox;

    setup(() => {
        sandbox = sinon.createSandbox();
    });

    teardown(() => {
        sandbox.restore();
    });

    suite('installOc', () => {
        test('error if called with invalid version', async () => {
            try {
                await Installer.installOc(undefined, 'OS');
                expect.fail();
            } catch (err) {
                expect(err.message).equals('Invalid version input. Provide a valid version number or url where to download an oc bundle.');
            }
        });

        test('check if getOcBundleUrl called if version is not URL', async () => {
            const getOcBundleStub = sandbox.stub(Installer, 'getOcBundleUrl').resolves('url');
            sandbox.stub(Installer, 'downloadAndExtract').resolves('ocbinary');
            await Installer.installOc('3.11', 'OS');
            expect(getOcBundleStub).calledOnceWith('3.11', 'OS');
        });

        test('check if getOcBundleUrl NOT called if version is not URL', async () => {
            sandbox.stub(validUrl, 'isWebUri').returns(true);
            const getOcBundleStub = sandbox.stub(Installer, 'getOcBundleUrl').resolves('url');
            sandbox.stub(Installer, 'downloadAndExtract').resolves('ocbinary');
            await Installer.installOc('url', 'OS');
            expect(getOcBundleStub).not.called;
        });

        test('check if correct oc binary path is returned', async () => {
            sandbox.stub(Installer, 'getOcBundleUrl').resolves('url');
            const downloadExtractStub = sandbox.stub(Installer, 'downloadAndExtract').resolves('ocbinary');
            const res = await Installer.installOc('3.11', 'OS');
            expect(downloadExtractStub).calledOnceWith('url', 'OS');
            expect(res).equals('ocbinary');
        });
    });

    suite('downloadAndExtract', () => {
        test('return null if url is not valid', async () => {
            try {
                await Installer.downloadAndExtract('', 'OS');
                expect.fail();
            } catch (err) {
                expect(err.message).equals('Unable to determine oc download URL.');
            }
        });

        test('check if extractZip is called when OS is Windows', async () => {
            sandbox.stub(tc, 'downloadTool').resolves('path');
            const extractZipStub = sandbox.stub(tc, 'extractZip').resolves('dir');
            sandbox.stub(ioUtil, 'exists').resolves(true);
            sandbox.stub(fs, 'chmodSync');
            await Installer.downloadAndExtract('url', 'Windows');
            expect(extractZipStub).calledOnceWith('path');
        });

        test('check if extractTar is called when OS is NOT Windows', async () => {
            sandbox.stub(tc, 'downloadTool').resolves('path');
            const extractZipStub = sandbox.stub(tc, 'extractZip');
            const extractTarStub = sandbox.stub(tc, 'extractTar').resolves('dir');
            sandbox.stub(ioUtil, 'exists').resolves(true);
            sandbox.stub(fs, 'chmodSync');
            await Installer.downloadAndExtract('url', 'Linux');
            expect(extractZipStub).not.called;
            expect(extractTarStub).calledOnceWith('path');
        });

        test('check if return NULL when ocbinary NOT exists', async () => {
            sandbox.stub(tc, 'downloadTool').resolves('path');
            sandbox.stub(tc, 'extractTar').resolves('dir');
            sandbox.stub(ioUtil, 'exists').resolves(false);
            try {
                await Installer.downloadAndExtract('url', 'Linux');
                expect.fail();
            } catch (err) {
                expect(err.message).equals('Unable to download or extract oc binary.');
            }
        });

        test('check if return correct binary with Windows', async () => {
            sandbox.stub(tc, 'downloadTool').resolves('path');
            sandbox.stub(tc, 'extractZip').resolves('dir');
            sandbox.stub(ioUtil, 'exists').resolves(true);
            const fsStub = sandbox.stub(fs, 'chmodSync');
            const res = await Installer.downloadAndExtract('url', 'Windows');
            expect(fsStub).calledOnceWith('dir/oc.exe');
            expect(res).equals('dir/oc.exe');
        });

        test('check if return correct binary with OS different than Windows', async () => {
            sandbox.stub(tc, 'downloadTool').resolves('path');
            sandbox.stub(tc, 'extractTar').resolves('dir');
            sandbox.stub(ioUtil, 'exists').resolves(true);
            const fsStub = sandbox.stub(fs, 'chmodSync');
            const res = await Installer.downloadAndExtract('url', 'Linux');
            expect(fsStub).calledOnceWith('dir/oc');
            expect(res).equals('dir/oc');
        });
    });

    suite('getOcBundleUrl', () => {
        const ocUtils = {
            'openshiftV3BaseUrl': 'urlv3',
            'openshiftV4BaseUrl': 'urlv4'
        };

        test('check if latest url returned if request latest oc version', async () => {
            const latestStub = sandbox.stub(Installer, 'latest').resolves('urllatest');
            const res = await Installer.getOcBundleUrl('latest', 'OS');
            expect(latestStub).calledOnceWith('OS');
            expect(res).equals('urllatest');
        });

        test('return null if version is not in valid format', async () => {
            const res = await Installer.getOcBundleUrl('invalidversion', 'OS');
            expect(res).equals(null);
        });

        test('check if valid url is returned if major version is 3', async () => {
            sandbox.stub(Installer, 'getOcUtils').resolves(ocUtils);
            sandbox.stub(Installer, 'getOcBundleByOS').returns('ocbundle');
            const res = await Installer.getOcBundleUrl('3.11', 'OS');
            expect(res).equals('urlv3/3.11/ocbundle');
        });

        test('check if valid url is returned if major version is 4', async () => {
            sandbox.stub(Installer, 'getOcUtils').resolves(ocUtils);
            sandbox.stub(Installer, 'getOcBundleByOS').returns('ocbundle');
            const res = await Installer.getOcBundleUrl('4.1', 'OS');
            expect(res).equals('urlv4/4.1/ocbundle');
        });

        test('null if major version is neither 3 nor 4', async () => {
            sandbox.stub(Installer, 'getOcUtils').resolves(ocUtils);
            const res = await Installer.getOcBundleUrl('2.1', 'OS');
            expect(res).equals(null);
        });

        test('null if unable to find oc bundle url', async () => {
            sandbox.stub(Installer, 'getOcUtils').resolves(ocUtils);
            const ocBundleStub = sandbox.stub(Installer, 'getOcBundleByOS').returns(null);
            const res = await Installer.getOcBundleUrl('4.1', 'OS');
            expect(ocBundleStub).calledOnceWith('OS');
            expect(res).equals(null);
        });
    });

    suite('latest', () => {
        test('returns null if oc bundle url not found', async () => {
            sandbox.stub(Installer, 'getOcBundleByOS').returns(null);
            const res = await Installer.latest('OS');
            expect(res).equals(null);
        });

        test('check if latest oc version is returned if bundle url is found', async () => {
            const ocUtils = {
                'openshiftV3BaseUrl': 'urlv3',
                'openshiftV4BaseUrl': 'urlv4'
            };
            const ocBundleStub = sandbox.stub(Installer, 'getOcBundleByOS').returns('ocbundle');
            sandbox.stub(Installer, 'getOcUtils').resolves(ocUtils);
            const res = await Installer.latest('OS');
            expect(ocBundleStub).calledOnceWith('OS');
            expect(res).equals('urlv4/latest/ocbundle');
        });
    });

    suite('getOcBundleByOS', () => {
        test('check if correct url is returned if OS is Windows', async () => {
            const res = await Installer.getOcBundleByOS('Windows');
            expect(res).equals('windows/oc.zip');
        });

        test('check if correct url is returned if OS is Linux', async () => {
            const res = await Installer.getOcBundleByOS('Linux');
            expect(res).equals('linux/oc.tar.gz');
        });

        test('check if correct url is returned if OS is MacOS', async () => {
            const res = await Installer.getOcBundleByOS('macOS');
            expect(res).equals('macosx/oc.tar.gz');
        });

        test('returns null with invalid OS', async () => {
            const res = await Installer.getOcBundleByOS('OS');
            expect(res).equals(null);
        });
    });

    suite('#getlocalOcPath', () => {
        test('returns path found by which if no error occurs and there is no version as input', async () => {
          const whichStub = sandbox.stub(io, 'which').resolves('path');
          const res = await Installer.getLocalOcPath();
          sinon.assert.calledWith(whichStub, 'oc', true);
          expect(res).equals('path');
        });
    
        test('returns undefined if which fails retrieving oc path', async () => {
          sandbox.stub(io, 'which').throws();
          const res = await Installer.getLocalOcPath('1.1');
          expect(res).equals(undefined);
        });
    
        test('returns nothing if oc path exists but oc version cannot be retrieved', async () => {
          sandbox.stub(io, 'which').resolves('path');
          const getOcStub = sandbox
            .stub(Installer, 'getOcVersion')
            .resolves(undefined);
          const res =  await Installer.getLocalOcPath('1.1');
          sinon.assert.calledWith(getOcStub, 'path');
          expect(res).equals(undefined);
        });
    
        test('returns nothing if version found locally is not the one user wants to use', async () => {
          sandbox.stub(io, 'which').resolves('path');
          sandbox.stub(Installer, 'getOcVersion').resolves('2.1');
          const res = await Installer.getLocalOcPath('1.1');
          expect(res).equals(undefined);
        });
    });

    suite('#getOcVersion', () => {
        let execOcStub: sinon.SinonStub;
    
        test('check if execute is called only once if succeed first time', async () => {
          execOcStub = sandbox.stub(Command, 'execute').resolves(0);
          await Installer.getOcVersion('path');
          sinon.assert.calledOnce(execOcStub);
        });
    
        test('check if execOcSync is called twice if first call returns nothing', async () => {
          execOcStub = sandbox.stub(Command, 'execute')
                                .onFirstCall()
                                .resolves(1)
                                .onSecondCall()
                                .resolves(0);
          await Installer.getOcVersion('path');
          sinon.assert.calledTwice(execOcStub);
        });
    
        test('returns undefined if both oc calls fail', async () => {
          execOcStub = sandbox.stub(Command, 'execute')
            .onFirstCall()
            .resolves(1)
            .onSecondCall()
            .resolves(1);
          const res = await Installer.getOcVersion('path');
          expect(res).equals(undefined);
        });
    });

    suite('getOcUtils', () => {
        test('check if readfile is called with right params', async () => {
            const ocUtils = `{
                "openshiftV3BaseUrl": "urlv3",
                "openshiftV4BaseUrl": "urlv4"
            }`;
            const ocUtilsJSON = {
                openshiftV3BaseUrl: 'urlv3',
                openshiftV4BaseUrl: 'urlv4'
            };
            // eslint-disable-next-line no-undef
            const pathJson = path.join(__dirname, '/../../oc-utils.json');
            const readFileStub = sandbox.stub(fs, 'readFile').resolves(ocUtils);
            const res = await Installer.getOcUtils();
            expect(readFileStub).calledOnceWith(pathJson);
            expect(res).deep.equals(ocUtilsJSON);
        });
    });
});