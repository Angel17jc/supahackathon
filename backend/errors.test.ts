import assert from "node:assert/strict";
import test from "node:test";
import { getApiError } from "./errors.js";

test("maps database conflicts to HTTP 409", () => {
  assert.deepEqual(getApiError({ code: "23505" }), {
    status: 409,
    message: "A record with these values already exists",
  });
});

test("maps missing records to HTTP 404", () => {
  assert.deepEqual(getApiError({ code: "P0002" }), {
    status: 404,
    message: "The requested record was not found",
  });
});

test("does not expose unexpected error details", () => {
  assert.deepEqual(getApiError({ message: "database host details" }), {
    status: 500,
    message: "An unexpected error occurred",
  });
});
