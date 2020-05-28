// Copyright (C) 2020 Russell Clarey. All rights reserved. MIT license.

export interface BencodeableList extends Array<Bencodeable> {}
export interface BencodeableDict extends Record<string, Bencodeable> {}
export type Bencodeable =
  | Uint8Array
  | number
  | BencodeableList
  | BencodeableDict
  | Map<Uint8Array, Bencodeable>;

const COLON = ":".charCodeAt(0);
const INTEGER = "i".charCodeAt(0);
const LIST = "l".charCodeAt(0);
const DICTIONARY = "d".charCodeAt(0);
const END = "e".charCodeAt(0);

const te = new TextEncoder();
const td = new TextDecoder();

function encode(byteArray: number[], data: Bencodeable): void {
  if (data instanceof Uint8Array) {
    byteArray.push(...te.encode(data.length.toString()), COLON, ...data);
  } else if (Array.isArray(data)) {
    byteArray.push(LIST);
    for (let i = 0; i < data.length; i += 1) {
      encode(byteArray, data[i]);
    }
    byteArray.push(END);
  } else if (data instanceof Map) {
    byteArray.push(DICTIONARY);
    for (const [key, val] of data.entries()) {
      encode(byteArray, key);
      encode(byteArray, val);
    }
    byteArray.push(END);
  } else if (data instanceof Object) {
    byteArray.push(DICTIONARY);
    for (const [key, val] of Object.entries(data)) {
      encode(byteArray, te.encode(key));
      encode(byteArray, val);
    }
    byteArray.push(END);
  } else {
    byteArray.push(...te.encode(`i${data}e`));
  }
}

export function bencode(allData: Bencodeable): Uint8Array {
  const byteArray: number[] = [];
  encode(byteArray, allData);
  return Uint8Array.from(byteArray);
}

function decodeInt(data: Uint8Array, start: number): [number, number] {
  if (data[start] !== INTEGER) {
    throw new Error("Failed to bdecode. Malformed int");
  }

  let n = start + 1;
  let digits: number[] = [];
  while (data[n] !== END) {
    digits.push(data[n]);
    n += 1;
  }
  n += 1;

  const value = Number(td.decode(Uint8Array.from(digits)));
  return [n, value];
}

function decodeString(data: Uint8Array, start: number): [number, Uint8Array] {
  const ind = data.indexOf(COLON, start);
  const digits = data.subarray(start, ind);

  const length = Number(td.decode(Uint8Array.from(digits)));
  if (length === 0) {
    throw new Error("Failed to bdecode. Malformed string");
  }

  const value = data.subarray(ind + 1, ind + length + 1);
  return [ind + length + 1, value];
}

function decodeList(
  data: Uint8Array,
  start: number,
): [number, BencodeableList] {
  if (data[start] !== LIST) {
    throw new Error("Failed to bdecode. Malformed list");
  }

  const list = [];
  let n = 1 + start;
  let value: Bencodeable;
  while (data[n] !== END) {
    [n, value] = decode(data, n);
    list.push(value);
  }
  n += 1;
  return [n, list];
}

function decodeDict(
  data: Uint8Array,
  start: number,
): [number, BencodeableDict] {
  if (data[start] !== DICTIONARY) {
    throw new Error("Failed to bdecode. Malformed dictionary");
  }

  const dict: BencodeableDict = {};
  let n = 1 + start;
  let key: string;
  let keyByteString: Uint8Array;
  let value: Bencodeable;
  while (data[n] !== END) {
    [n, keyByteString] = decodeString(data, n);
    key = td.decode(keyByteString);
    [n, value] = decode(data, n);
    dict[key] = value;
  }
  n += 1;
  return [n, dict];
}

function decode(data: Uint8Array, start: number): [number, Bencodeable] {
  switch (data[start]) {
    case 100:
      return decodeDict(data, start);
    case 108:
      return decodeList(data, start);
    case 105:
      return decodeInt(data, start);
    default:
      return decodeString(data, start);
  }
}

export function bdecode(data: Uint8Array): Bencodeable {
  return decode(data, 0)[1];
}