import { IDataSource } from "./IDataSource";


export class DataSourceManager {
    private dataSources: Map<string, IDataSource> = new Map();
    private activeDataSourceId: string = "default";

    constructor() { }

    public registerDataSource(id: string, dataSource: IDataSource) {
        this.dataSources.set(id, dataSource);
    }

    public getDataSource(id: string): IDataSource | undefined {
        return this.dataSources.get(id);
    }

    public getActiveDataSource(): IDataSource | undefined {
        return this.dataSources.get(this.activeDataSourceId);
    }

    public setActiveDataSource(id: string) {
        if (this.dataSources.has(id)) {
            this.activeDataSourceId = id;
        } else {
            throw new Error(`Data source with id ${id} not found`);
        }
    }
}
