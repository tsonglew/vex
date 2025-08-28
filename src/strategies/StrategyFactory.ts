import { VectorDBStrategy } from './VectorDBStrategy';
import { MilvusStrategy } from './MilvusStrategy';
import { ChromaDBStrategy } from './ChromaDBStrategy';

export class StrategyFactory {
    static createStrategy( type: string ): VectorDBStrategy {
        switch ( type.toLowerCase() ) {
            case 'milvus':
                return new MilvusStrategy();
            case 'chroma':
            case 'chromadb':
                return new ChromaDBStrategy();
            default:
                throw new Error( `Unsupported database type: ${type}` );
        }
    }

    static getSupportedTypes(): string[] {
        return ['milvus', 'chroma'];
    }
}
