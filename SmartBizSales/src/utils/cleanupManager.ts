// src/utils/cleanupManager.ts
class CleanupManager {
  private static timers: Set<NodeJS.Timeout> = new Set();
  private static intervals: Set<NodeJS.Timeout> = new Set();
  private static listeners: Map<string, Function> = new Map();
  private static abortControllers: Set<AbortController> = new Set();

  static registerTimer(timer: NodeJS.Timeout): void {
    this.timers.add(timer);
  }

  static registerInterval(interval: NodeJS.Timeout): void {
    this.intervals.add(interval);
  }

  static registerListener(key: string, cleanup: Function): void {
    this.listeners.set(key, cleanup);
  }

  static registerAbortController(controller: AbortController): void {
    this.abortControllers.add(controller);
  }

  static cleanup(screenName?: string): void {
    console.log(`🧹 Cleanup ${screenName || "All"} - Starting...`);

    // Clear timers
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();
    console.log(" Timers cleared");

    // Clear intervals
    this.intervals.forEach((interval) => clearInterval(interval));
    this.intervals.clear();
    console.log(" Intervals cleared");

    // Clear listeners
    this.listeners.forEach((cleanup, key) => {
      try {
        cleanup();
      } catch (error) {
        console.error(`Error cleaning up listener ${key}:`, error);
      }
    });
    this.listeners.clear();
    console.log(" Listeners cleared");

    // Abort requests
    this.abortControllers.forEach((controller) => {
      try {
        controller.abort();
      } catch (error) {
        console.error("Error aborting request:", error);
      }
    });
    this.abortControllers.clear();
    console.log(" Requests aborted");

    console.log("🧹 Cleanup complete");
  }

  static getStats(): object {
    return {
      timers: this.timers.size,
      intervals: this.intervals.size,
      listeners: this.listeners.size,
      abortControllers: this.abortControllers.size,
    };
  }
}

export default CleanupManager;
