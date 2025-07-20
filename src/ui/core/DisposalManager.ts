import * as vscode from 'vscode';

/**
 * Manages proper disposal of all UI components and resources
 */
export class DisposalManager {
  private disposables: vscode.Disposable[] = [];
  private cleanupTasks: Array<() => void | Promise<void>> = [];

  /**
   * Register a disposable resource
   */
  public register(disposable: vscode.Disposable): void {
    this.disposables.push(disposable);
  }

  /**
   * Register multiple disposable resources
   */
  public registerMultiple(disposables: vscode.Disposable[]): void {
    this.disposables.push(...disposables);
  }

  /**
   * Register a cleanup task (function to call during disposal)
   */
  public registerCleanupTask(task: () => void | Promise<void>): void {
    this.cleanupTasks.push(task);
  }

  /**
   * Dispose all registered resources and run cleanup tasks
   */
  public async dispose(): Promise<void> {
    console.log('DisposalManager: Starting disposal process...');
    
    // Run cleanup tasks first
    for (const task of this.cleanupTasks) {
      try {
        await task();
      } catch (error) {
        console.error('DisposalManager: Error running cleanup task:', error);
      }
    }
    
    // Dispose all registered disposables
    for (const disposable of this.disposables) {
      try {
        disposable.dispose();
      } catch (error) {
        console.error('DisposalManager: Error disposing resource:', error);
      }
    }
    
    // Clear arrays
    this.disposables = [];
    this.cleanupTasks = [];
    
    console.log('DisposalManager: Disposal process completed');
  }

  /**
   * Get count of registered disposables
   */
  public getDisposableCount(): number {
    return this.disposables.length;
  }

  /**
   * Get count of registered cleanup tasks
   */
  public getCleanupTaskCount(): number {
    return this.cleanupTasks.length;
  }

  /**
   * Check if any resources are registered
   */
  public hasResources(): boolean {
    return this.disposables.length > 0 || this.cleanupTasks.length > 0;
  }
}

/**
 * Global disposal manager instance
 */
export const disposalManager = new DisposalManager();