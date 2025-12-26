export interface IDataSource {
  /**
   * Fetches metrics from the data source.
   * @param query The query string.
   */
  query(query: string): Promise<any>;

  /**
   * Fetches metrics over a range of time.
   * @param query The query string.
   * @param start Start timestamp in seconds.
   * @param end End timestamp in seconds.
   * @param step Query resolution step width in seconds.
   */
  queryRange(query: string, start: number, end: number, step: number): Promise<any>;

  /**
   * Fetches alerts from the data source.
   */
  getAlerts(): Promise<any>;

  /**
   * Tests the connection to the data source.
   */
  testConnection(): Promise<boolean>;
}
