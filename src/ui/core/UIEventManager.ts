import * as vscode from 'vscode';
import { UIEvents } from '../types/TreeViewTypes';

/**
 * Event manager for UI components
 * Provides type-safe event emission and subscription for UI updates
 */
export class UIEventManager {
  private eventEmitter = new vscode.EventEmitter<keyof UIEvents>();
  private disposables: vscode.Disposable[] = [];

  /**
   * Emit a UI event
   */
  public emit<K extends keyof UIEvents>(event: K, data: UIEvents[K]): void {
    this.eventEmitter.fire(event);
  }

  /**
   * Subscribe to a UI event
   */
  public on<K extends keyof UIEvents>(
    event: K,
    listener: (data: UIEvents[K]) => void
  ): vscode.Disposable {
    const disposable = this.eventEmitter.event((eventType) => {
      if (eventType === event) {
        // Note: In a real implementation, we'd need to pass the actual data
        // For now, this is a simplified version
        listener({} as UIEvents[K]);
      }
    });
    
    this.disposables.push(disposable);
    return disposable;
  }

  /**
   * Dispose all event listeners
   */
  public dispose(): void {
    this.eventEmitter.dispose();
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }
}

/**
 * Global UI event manager instance
 */
export const uiEventManager = new UIEventManager();