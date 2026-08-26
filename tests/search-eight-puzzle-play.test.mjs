import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const lesson=new URL("../lessons/search-eight-puzzle/",import.meta.url);
const play=new URL("../lessons/search-eight-puzzle-play/",import.meta.url);
test("8-퍼즐 직접 체험은 BFS 이론 페이지 안에 먼저 배치된다",async()=>{const html=await readFile(new URL("index.html",lesson),"utf8");assert.match(html,/id="play-board"/);assert.match(html,/id="move-count"/);assert.ok(html.indexOf('id="play-board"')<html.indexOf('id="puzzle-game"'));assert.doesNotMatch(html,/href="\.\.\/search-eight-puzzle-play\/"/);});
test("두 모듈 스크립트 태그가 완전히 닫혀 숫자판 스크립트가 실행된다",async()=>{const html=await readFile(new URL("index.html",lesson),"utf8");assert.match(html,/<script type="module" src="game\.js\?v=\d+"><\/script>/);assert.match(html,/<script type="module" src="\.\.\/search-eight-puzzle-play\/game\.js\?v=\d+"><\/script>/);assert.doesNotMatch(html,/src="[^"]+"<\/script>/);});
test("통합된 체험은 8회 문제와 도움 기능을 유지한다",async()=>{const [html,js]=await Promise.all([readFile(new URL("index.html",lesson),"utf8"),readFile(new URL("game.js",play),"utf8")]);assert.match(html,/id="hint"/);assert.match(js,/PLAY_START=Object\.freeze\(\[1,5,2,8,0,3,4,7,6\]\)/);assert.match(js,/const minimum=8/);});
