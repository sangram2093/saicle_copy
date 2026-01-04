import { describe, expect, it, vi } from "vitest";
import { lsToolImpl } from "./lsTool";
import { readFileImpl } from "./readFile";

describe("Retry Logic - readFile", () => {
  it("should succeed on first attempt if no error", async () => {
    const mockIde = {
      readFile: vi.fn().mockResolvedValue("content"),
      fileExists: vi.fn().mockResolvedValue(true),
      getWorkspaceDirs: vi.fn().mockResolvedValue(["file:///workspace"]),
    };

    const extras = {
      ide: mockIde,
      config: {
        selectedModelByRole: {
          chat: { contextLength: 10000 },
        },
      },
    };

    const args = { filepath: "test.ts" };

    const result = await readFileImpl(args, extras);

    expect(mockIde.readFile).toHaveBeenCalledTimes(1);
    expect(result).toBeDefined();
  });

  it("should retry and succeed on second attempt after transient error", async () => {
    let callCount = 0;
    const mockIde = {
      readFile: vi.fn(async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error("EBUSY: device or resource busy");
        }
        return "content";
      }),
      fileExists: vi.fn().mockResolvedValue(true),
      getWorkspaceDirs: vi.fn().mockResolvedValue(["file:///workspace"]),
    };

    const extras = {
      ide: mockIde,
      config: {
        selectedModelByRole: {
          chat: { contextLength: 10000 },
        },
      },
    };

    const args = { filepath: "test.ts" };

    const result = await readFileImpl(args, extras);

    expect(mockIde.readFile).toHaveBeenCalledTimes(2);
    expect(result).toBeDefined();
  });

  it("should fail after max retries exhausted", async () => {
    const mockIde = {
      readFile: vi
        .fn()
        .mockRejectedValue(new Error("EBUSY: device or resource busy")),
      fileExists: vi.fn().mockResolvedValue(true),
      getWorkspaceDirs: vi.fn().mockResolvedValue(["file:///workspace"]),
    };

    const extras = {
      ide: mockIde,
      config: {
        selectedModelByRole: {
          chat: { contextLength: 10000 },
        },
      },
    };

    const args = { filepath: "test.ts" };

    await expect(readFileImpl(args, extras)).rejects.toThrow(
      "EBUSY: device or resource busy",
    );

    expect(mockIde.readFile).toHaveBeenCalledTimes(3);
  });

  it("should use exponential backoff delays between retries", async () => {
    vi.useFakeTimers();
    let callCount = 0;
    const mockIde = {
      readFile: vi.fn(async () => {
        callCount++;
        if (callCount <= 2) {
          throw new Error("Transient error");
        }
        return "content";
      }),
      fileExists: vi.fn().mockResolvedValue(true),
      getWorkspaceDirs: vi.fn().mockResolvedValue(["file:///workspace"]),
    };

    const extras = {
      ide: mockIde,
      config: {
        selectedModelByRole: {
          chat: { contextLength: 10000 },
        },
      },
    };

    const args = { filepath: "test.ts" };

    const promise = readFileImpl(args, extras);

    await vi.advanceTimersByTimeAsync(0);
    expect(mockIde.readFile).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(50);
    expect(mockIde.readFile).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(100);
    expect(mockIde.readFile).toHaveBeenCalledTimes(3);

    const result = await promise;
    expect(result).toBeDefined();

    vi.useRealTimers();
  });
});

describe("Retry Logic - lsTool", () => {
  it("should succeed on first attempt if no error", async () => {
    const mockIde = {
      listDir: vi.fn().mockResolvedValue([["file1.ts", 1]]),
      fileExists: vi.fn().mockResolvedValue(true),
      getWorkspaceDirs: vi.fn().mockResolvedValue(["file:///workspace"]),
    };

    const extras = {
      ide: mockIde,
    };

    const args = { dirPath: "/" };

    const result = await lsToolImpl(args, extras);

    expect(mockIde.listDir).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it("should retry walkDir on transient failure", async () => {
    let callCount = 0;
    const mockIde = {
      listDir: vi.fn(async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error("EACCES: permission denied");
        }
        return [["file1.ts", 1]];
      }),
      fileExists: vi.fn().mockResolvedValue(true),
      getWorkspaceDirs: vi.fn().mockResolvedValue(["file:///workspace"]),
    };

    const extras = {
      ide: mockIde,
    };

    const args = { dirPath: "/" };

    const result = await lsToolImpl(args, extras);

    expect(mockIde.listDir).toHaveBeenCalledTimes(2);
    expect(result).toBeDefined();
  });

  it("should fail after max retries exhausted for lsTool", async () => {
    const mockIde = {
      listDir: vi.fn().mockRejectedValue(new Error("EIO: input/output error")),
      fileExists: vi.fn().mockResolvedValue(true),
      getWorkspaceDirs: vi.fn().mockResolvedValue(["file:///workspace"]),
    };

    const extras = {
      ide: mockIde,
    };

    const args = { dirPath: "/" };

    await expect(lsToolImpl(args, extras)).rejects.toThrow(
      "EIO: input/output error",
    );

    expect(mockIde.listDir).toHaveBeenCalledTimes(3);
  });
});
