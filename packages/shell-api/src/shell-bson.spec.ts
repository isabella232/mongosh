/* eslint @typescript-eslint/camelcase: 0, new-cap: 0, @typescript-eslint/ban-ts-ignore: 0 */
import shellBson from './shell-bson';
import { expect } from 'chai';

const hex_1234 = '31323334';
const b64_1234 = 'MTIzNA==';
const utf_1234 = '1234';

describe('Shell BSON', () => {
  describe('Code', () => {
    it('expects arguments in order', () => {
      const code = shellBson.Code('code', { k: 'v' });
      expect(code.code).to.equal('code');
      expect(code.scope).to.deep.equal({ k: 'v' });
    });
  });
  describe('Date', () => {
    it('returns string without new', () => {
      expect(shellBson.Date()).to.be.a('string');
    });
    it('returns now object with new', () => {
      // @ts-ignore
      const date = new shellBson.Date();
      const cDate = new Date();
      expect(typeof date).to.equal('object');
      // @ts-ignore
      expect(date.getYear()).to.equal(cDate.getYear());
    });
    it('ISODate is always object', () => {
      // @ts-ignore
      const date = new shellBson.ISODate();
      expect(typeof date).to.equal('object');
      const date2 = shellBson.ISODate();
      expect(typeof date2).to.equal('object');
    });
  });
  describe('BinData', () => {
    const b = shellBson.BinData(128, b64_1234);
    it('expects strings as base 64', () => {
      expect(b.value()).to.equal(utf_1234);
    });
  });
  describe('HexData', () => {
    const b = shellBson.BinData(128, b64_1234);
    const h = shellBson.HexData(128, hex_1234);
    it('equals BinData', () => {
      expect(b.value()).to.equal(h.value());
      expect(b.sub_type).to.equal(h.sub_type);
    });
    it('equals 1234', () => {
      expect(h.value()).to.equal(utf_1234);
    });
    it('has subtype', () => {
      expect(h.sub_type).to.equal(128);
    });
  });
  describe('UUID', () => {
    const b = shellBson.BinData(4, b64_1234);
    const h = shellBson.UUID(hex_1234);
    it('equals BinData', () => {
      expect(b.value()).to.equal(h.value());
      expect(b.sub_type).to.equal(h.sub_type);
    });
    it('equals 1234', () => {
      expect(h.value()).to.equal(utf_1234);
    });
    it('has subtype', () => {
      expect(h.sub_type).to.equal(4);
    });
  });
  describe('MD5', () => {
    const b = shellBson.BinData(5, b64_1234);
    const h = shellBson.MD5(hex_1234);
    it('equals BinData', () => {
      expect(b.value()).to.equal(h.value());
      expect(b.sub_type).to.equal(h.sub_type);
    });
    it('equals 1234', () => {
      expect(h.value()).to.equal(utf_1234);
    });
    it('has subtype', () => {
      expect(h.sub_type).to.equal(5);
    });
  });
  describe('bsonsize', () => {
    it('calculates empty doc size', () => {
      expect(shellBson.bsonsize({})).to.equal(5);
    });
  });
});