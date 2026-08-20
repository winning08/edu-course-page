import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const root=new URL("../lessons/turing-test-questions/",import.meta.url);
test("외부 구글 설문 대신 활동지 내장 제출 폼을 제공한다",async()=>{const html=await readFile(new URL("index.html",root),"utf8");assert.match(html,/id="turing-form"/);assert.match(html,/name="student_number"/);assert.match(html,/name="question"/);assert.match(html,/name="reason"/);assert.doesNotMatch(html,/docs\.google\.com\/forms/);});
test("우리 학교 결과 보기 링크는 더 이상 노출되지 않는다",async()=>{const html=await readFile(new URL("index.html",root),"utf8");assert.match(html,/id="submit-success"[^>]*hidden/);assert.doesNotMatch(html,/우리 학교 결과 보기/);});
test("필수값과 추가 질문 이유를 검사하고 성공 응답 뒤에만 결과를 공개한다",async()=>{const js=await readFile(new URL("form.js",root),"utf8");assert.match(js,/student_number/);assert.match(js,/followup_reason/);assert.match(js,/if\(!result\.success\)/);assert.match(js,/success\.hidden=false/);});
test("학번은 학급을 안전하게 추출할 수 있도록 5자리 숫자만 받는다",async()=>{const html=await readFile(new URL("index.html",root),"utf8");const js=await readFile(new URL("form.js",root),"utf8");assert.match(html,/pattern="\[0-9\]\{5\}"/);assert.match(html,/maxlength="5"/);assert.match(js,/\^\\d\{5\}\$/);});
