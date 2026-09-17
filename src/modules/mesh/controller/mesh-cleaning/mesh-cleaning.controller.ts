import type { Mesh } from "../../types/mesh.types.js";
import type { MeshCleaningOptions, MeshCleaningReport } from "../../types/mesh-cleaning.types.js";
import { removeSmallComponents } from "../../services/connected-component-filter/connected-component-filter.js";
import { fillHoles } from "../../services/hole-filler/hole-filler.js";
import { simplifyMesh } from "../../services/mesh-simplifier/mesh-simplifier.js";

export type MeshCleaningResult = {
  readonly mesh: Mesh;
  readonly report: MeshCleaningReport;
};

export const createMeshCleaningController = () =>
  Object.freeze({
    clean: async (inputMesh: Mesh, options: MeshCleaningOptions): Promise<MeshCleaningResult> => {
      const simplifiedMesh = await simplifyMesh(
        inputMesh,
        options.targetTriangleCount,
        options.simplificationErrorTolerance,
      );

      const componentFilterResult = removeSmallComponents(
        simplifiedMesh,
        options.smallComponentAreaFraction,
      );

      const holeFillResult = options.isFillHolesEnabled
        ? fillHoles(componentFilterResult.mesh)
        : { mesh: componentFilterResult.mesh, filledHoleCount: 0 };

      return Object.freeze({
        mesh: holeFillResult.mesh,
        report: Object.freeze({
          inputTriangleCount: inputMesh.triangleCount,
          weldedVertexCount: inputMesh.vertexCount,
          simplifiedTriangleCount: simplifiedMesh.triangleCount,
          removedComponentCount: componentFilterResult.removedComponentCount,
          filledHoleCount: holeFillResult.filledHoleCount,
          outputTriangleCount: holeFillResult.mesh.triangleCount,
        }),
      });
    },
  });
