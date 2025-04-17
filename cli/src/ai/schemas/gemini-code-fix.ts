// src/ai/schemas/code-fix-schema.ts
import { Type } from '@google/genai';

export const geminiCodeFix = {
    type: Type.OBJECT,
    properties: {
        'explanation': {
            type: Type.STRING,
            description: 'Brief explanation of what caused the error and how the fix addresses it',
            nullable: false
        },
        'changes': {
            type: Type.ARRAY,
            items: {  
                type: Type.OBJECT,
                properties: {
                    'filePath': {
                        type: Type.STRING,
                        description: 'Path to the file that needs to be changed',
                        nullable: false
                    },
                    'codeChanges': { // Note: matches your updated field name in FileChange
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                'type': {
                                    type: Type.STRING,
                                    description: 'Type of change, which is always "replace"',
                                    nullable: false
                                },
                                'lineStart': {
                                    type: Type.INTEGER,
                                    description: 'Start line of the change',
                                    nullable: false
                                },
                                'lineEnd': {
                                    type: Type.INTEGER,
                                    description: 'End line of the change',
                                    nullable: false
                                },
                                'originalCode': {
                                    type: Type.STRING,
                                    description: 'Original code before the change',
                                    nullable: false
                                },
                                'newCode': {
                                    type: Type.STRING,
                                    description: 'New code after the change',
                                    nullable: false
                                }
                            },
                            required: ['type', 'lineStart', 'lineEnd', 'originalCode', 'newCode']
                        }
                    }
                }
            }
        }
    },
    required: ['explanation', 'changes']
};
