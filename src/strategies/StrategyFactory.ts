import { VectorDBStrategy } from './VectorDBStrategy';
import { MilvusStrategy } from './MilvusStrategy';
import { ChromaDBStrategy } from './ChromaDBStrategy';
import { PlaceholderStrategy } from './PlaceholderStrategy';

export class StrategyFactory {
    static createStrategy( type: string ): VectorDBStrategy {
        switch ( type.toLowerCase() ) {
            case 'milvus':
                return new MilvusStrategy();
            case 'chroma':
            case 'chromadb':
                return new ChromaDBStrategy();
            case 'pinecone':
                return new PlaceholderStrategy( 'pinecone' );
            case 'weaviate':
                return new PlaceholderStrategy( 'weaviate' );
            case 'qdrant':
                return new PlaceholderStrategy( 'qdrant' );
            case 'faiss':
                return new PlaceholderStrategy( 'faiss' );
            case 'elasticsearch':
                return new PlaceholderStrategy( 'elasticsearch' );
            case 'vespa':
                return new PlaceholderStrategy( 'vespa' );
            case 'redis':
                return new PlaceholderStrategy( 'redis' );
            case 'pgvector':
                return new PlaceholderStrategy( 'pgvector' );
            default:
                throw new Error( `Unsupported database type: ${type}` );
        }
    }

    static getSupportedTypes(): string[] {
        return ['milvus', 'chroma', 'pinecone', 'weaviate', 'qdrant', 'faiss', 'elasticsearch', 'vespa', 'redis', 'pgvector'];
    }
}
