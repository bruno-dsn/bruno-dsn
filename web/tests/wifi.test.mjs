import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { newWifiReview, validateWifiReview, restoreWifiReview, wifiSummary, wifiHTML } from "../wifi.js";

const catalog = JSON.parse(await readFile(new URL("../data/wifi-checklist.json", import.meta.url), "utf8"));

test("unknown Wi-Fi answers produce confirmation tasks without a security score", () => {
  const review = newWifiReview(catalog);
  const summary = wifiSummary(review, catalog);
  assert.deepEqual(summary.counts, { unknown: 6, review: 0, checked: 0, na: 0 });
  assert.equal(summary.tasks.length, 6);
  assert.equal(summary.tasks[0].action, catalog.controls[0].verify);
  review.answers.encryption = "review";
  assert.equal(wifiSummary(review, catalog).tasks[0].action, catalog.controls[0].next);
  assert.equal(Object.hasOwn(summary, "score"), false);
});

test("checked and not-applicable Wi-Fi answers require evidence or justification", () => {
  for (const status of ["checked", "na"]) {
    const review = newWifiReview(catalog);
    review.answers.encryption = status;
    review.notes.encryption = "   ";
    assert.throws(() => validateWifiReview(review, catalog), /exigem/);
    review.notes.encryption = "Configuração e data conferidas no exercício fictício.";
    assert.equal(wifiSummary(review, catalog).counts[status], 1);
    assert.equal(wifiSummary(review, catalog).tasks.length, 5);
    assert.deepEqual(JSON.parse(JSON.stringify(restoreWifiReview(JSON.stringify(review), catalog))), review);
  }
});

test("Wi-Fi restore rejects wrong contracts, repeated keys, unknown states and oversized notes", () => {
  for (const mutate of [
    (r) => { r.schema_version = true; },
    (r) => { r.kind = "assessment"; },
    (r) => { r.extra = "ignored?"; },
    (r) => { delete r.notes.guest; },
    (r) => { r.answers.guest = "secure"; },
    (r) => { r.notes.guest = "x".repeat(1001); },
    (r) => { r.network_name = " "; },
  ]) {
    const review = newWifiReview(catalog);
    mutate(review);
    assert.throws(() => restoreWifiReview(JSON.stringify(review), catalog));
  }
  const source = JSON.stringify(newWifiReview(catalog)).replace('"schema_version":1', '"schema_version":1,"schema_version":1');
  assert.throws(() => restoreWifiReview(source, catalog), /repetida/);
});

test("Wi-Fi report escapes names and notes and prohibits scripts", () => {
  const review = newWifiReview(catalog);
  review.network_name = '<img src=x onerror="alert(1)">';
  review.notes.encryption = '<script>alert("segredo")</script>';
  review.answers.encryption = "checked";
  const report = wifiHTML(review, catalog);
  assert.ok(!report.includes("<script>"));
  assert.ok(!report.includes("<img"));
  assert.ok(report.includes("&lt;script&gt;"));
  assert.ok(report.includes("default-src 'none'"));
  assert.match(report, /não conectou equipamentos/);
});
