// RPC Rate Limiting and Retry Logic
export class RpcRateLimit {
  private static lastCallTime: number = 0;
  private static minDelay: number = 1000; // 1 second minimum delay between calls
  private static maxRetries: number = 3;
  
  /**
   * Execute an RPC call with rate limiting and retry logic
   */
  static async execute<T>(
    fn: () => Promise<T>,
    context: string = 'RPC call'
  ): Promise<T> {
    // Rate limiting: ensure minimum delay between calls
    const now = Date.now();
    const timeSinceLastCall = now - this.lastCallTime;
    
    if (timeSinceLastCall < this.minDelay) {
      const delayNeeded = this.minDelay - timeSinceLastCall;
      console.log(`⏱️ Rate limiting: waiting ${delayNeeded}ms before ${context}`);
      await new Promise(resolve => setTimeout(resolve, delayNeeded));
    }
    
    this.lastCallTime = Date.now();
    
    // Retry logic with exponential backoff
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        
        // Check if it's a rate limit error (429)
        if (errorMsg.includes('429') || errorMsg.includes('rate limit')) {
          const backoffDelay = Math.pow(2, attempt) * 1000; // Exponential backoff
          console.log(`⚠️ Rate limit hit on attempt ${attempt}/${this.maxRetries} for ${context}`);
          console.log(`⏱️ Backing off for ${backoffDelay}ms...`);
          
          if (attempt < this.maxRetries) {
            await new Promise(resolve => setTimeout(resolve, backoffDelay));
            continue;
          }
        }
        
        // If not a rate limit error or max retries reached, throw the error
        if (attempt === this.maxRetries) {
          console.error(`❌ ${context} failed after ${this.maxRetries} attempts:`, errorMsg);
          throw error;
        }
        
        // For other errors, wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    throw new Error(`Max retries exceeded for ${context}`);
  }
  
  /**
   * Set the minimum delay between RPC calls
   */
  static setMinDelay(delay: number) {
    this.minDelay = delay;
  }
  
  /**
   * Set the maximum number of retries
   */
  static setMaxRetries(retries: number) {
    this.maxRetries = retries;
  }
}