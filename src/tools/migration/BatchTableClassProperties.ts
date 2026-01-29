import { ClassProperty } from "../../structure";

import { TileFormatError } from "../../tilesets";
import { TileTableData } from "../../tilesets";

import { TypeDetection } from "./TypeDetection";

/**
 * Methods to create `ClassProperty` objects from batch table properties.
 *
 * @internal
 */
export class BatchTableClassProperties {
  /**
   * Returns a `ClassProperty` that describes the given batch table
   * property.
   *
   * The `type`, `componentType`, `array` and `count` properties
   * of the class property will be set based on some unspecified
   * guesses. If no suitable type information can be obtained
   * from the given values, then a class property with the
   * type `STRING` will be returned.
   *
   * @param batchTablePropertyName - The property name
   * @param batchTablePropertyValue - The property value
   * @returns The `ClassProperty`
   * @throws TileFormatError If the given value is neither
   * a BatchTableBinaryBodyReference nor a numeric array
   */
  static createClassProperty(
    batchTablePropertyName: string,
    batchTablePropertyValue: any
  ): ClassProperty {
    let type: string;
    let componentType: string | undefined;
    let array = false;
    let count: number | undefined = undefined;
    let required = true;
    let noData: any = undefined;

    if (
      TileTableData.isBatchTableBinaryBodyReference(batchTablePropertyValue)
    ) {
      type = TileTableData.convertLegacyTypeToType(
        batchTablePropertyValue.type
      );
      componentType = TileTableData.convertLegacyComponentTypeToComponentType(
        batchTablePropertyValue.componentType
      );
    } else if (Array.isArray(batchTablePropertyValue)) {
      // Check if the array contains null/undefined values
      const hasNullValues = batchTablePropertyValue.some(
        (v) => v === null || v === undefined
      );

      const commonType = TypeDetection.computeCommonType(
        batchTablePropertyValue
      );
      if (commonType === undefined) {
        type = "STRING";
      } else {
        type = commonType;
        if (commonType !== "STRING" && commonType !== "BOOLEAN") {
          componentType = TypeDetection.computeCommonComponentType(
            batchTablePropertyValue
          );
        }
      }
      array = TypeDetection.containsOnlyArrays(batchTablePropertyValue);
      if (array) {
        count = TypeDetection.computeCommonArrayLegth(batchTablePropertyValue);
      }

      // Set noData sentinel value if nulls are present
      if (hasNullValues) {
        required = false;
        noData = BatchTableClassProperties.computeNoDataValue(
          type,
          componentType
        );
      }
    } else {
      throw new TileFormatError(
        `Batch table JSON property ${batchTablePropertyName} was ` +
          `not a binary body reference and not an array`
      );
    }

    const classProperty: ClassProperty = {
      name: batchTablePropertyName,
      description: `Generated from ${batchTablePropertyName}`,
      type: type,
      componentType: componentType,
      enumType: undefined,
      array: array,
      count: count,
      normalized: false,
      offset: undefined,
      scale: undefined,
      max: undefined,
      min: undefined,
      required: required,
      noData: noData,
      default: undefined,
      semantic: undefined,
    };
    console.log(`Class property for ${batchTablePropertyName}:`, classProperty);

    return classProperty;
  }

  /**
   * Computes an appropriate noData sentinel value for the given type.
   *
   * @param type - The metadata type (STRING, BOOLEAN, SCALAR)
   * @param componentType - The component type (INT8, FLOAT64, etc.)
   * @returns The noData sentinel value
   */
  private static computeNoDataValue(
    type: string,
    componentType: string | undefined
  ): any {
    if (type === "STRING") {
      return "";
    }
    if (type === "BOOLEAN") {
      return false;
    }
    if (type === "SCALAR" && componentType) {
      // For integers, use the most negative value as sentinel
      if (componentType === "INT8") return -128;
      if (componentType === "INT16") return -32768;
      if (componentType === "INT32") return -2147483648;
      if (componentType === "INT64") return "-9223372036854775808"; // As string for BigInt
      if (componentType === "UINT8") return 255;
      if (componentType === "UINT16") return 65535;
      if (componentType === "UINT32") return 4294967295;
      if (componentType === "UINT64") return "18446744073709551615"; // As string for BigInt

      // For floats, use largest representable value (not Infinity/NaN as they're not valid JSON)
      if (componentType === "FLOAT32") return 3.4028234663852886e38;
      if (componentType === "FLOAT64") return 1.7976931348623157e308;
    }
    return undefined;
  }
}
