import { JSONSchema7 } from 'json-schema';
import { v4 } from 'uuid';

const isNotEmpty = (...propertyNames: string[]): JSONSchema7 => {
  const properties = {};
  propertyNames.forEach(
    (property) =>
      (properties[property] = {
        minLength: 1,
        description: `The "${property}" cannot be empty`,
      }),
  );
  return {
    if: {
      propertyNames: {
        enum: [...propertyNames],
      },
    },
    then: { properties },
  };
};

export const proxySchema: JSONSchema7 = {
  $id: v4(),
  type: 'object',
  properties: {
    enabled: { type: 'boolean', enum: [true, false] },
    host: { type: 'string' },
    port: { type: 'string' },
    protocol: { type: 'string' },
    username: { type: 'string' },
    password: { type: 'string' },
  },
  required: ['enabled', 'host', 'port', 'protocol'],
  ...isNotEmpty('enabled', 'host', 'port', 'protocol'),
};