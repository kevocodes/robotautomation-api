import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

export function IsGreaterOrEqualThan(
  relatedProperty: string,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isGreaterOrEqualThan',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [relatedProperty],
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const [relatedPropertyName] = args.constraints;
          const container = args.object as Record<string, unknown>;
          const relatedValue = container?.[relatedPropertyName];

          if (typeof value !== 'number' || typeof relatedValue !== 'number') {
            return false;
          }

          return value >= relatedValue;
        },
        defaultMessage(args: ValidationArguments) {
          const [relatedPropertyName] = args.constraints;
          return `${args.property} must be greater than or equal to ${relatedPropertyName}`;
        },
      },
    });
  };
}
