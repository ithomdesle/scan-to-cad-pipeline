#!/usr/bin/env python3
"""Generate a simple test cube STL for pipeline testing"""

import struct

# Cube vertices (10mm x 10mm x 10mm centered at origin)
size = 10.0
half = size / 2.0

# Define the 8 vertices of the cube
vertices = [
    (-half, -half, -half),  # 0
    ( half, -half, -half),  # 1
    ( half,  half, -half),  # 2
    (-half,  half, -half),  # 3
    (-half, -half,  half),  # 4
    ( half, -half,  half),  # 5
    ( half,  half,  half),  # 6
    (-half,  half,  half),  # 7
]

# Define the 12 triangles (2 per face, 6 faces)
# Each triangle is defined by 3 vertex indices
triangles = [
    # Bottom face (z = -half)
    (0, 2, 1), (0, 3, 2),
    # Top face (z = half)
    (4, 5, 6), (4, 6, 7),
    # Front face (y = -half)
    (0, 1, 5), (0, 5, 4),
    # Back face (y = half)
    (2, 3, 7), (2, 7, 6),
    # Left face (x = -half)
    (0, 4, 7), (0, 7, 3),
    # Right face (x = half)
    (1, 2, 6), (1, 6, 5),
]

def compute_normal(v1, v2, v3):
    """Compute normal vector for a triangle"""
    # Edge vectors
    e1 = (v2[0] - v1[0], v2[1] - v1[1], v2[2] - v1[2])
    e2 = (v3[0] - v1[0], v3[1] - v1[1], v3[2] - v1[2])
    
    # Cross product
    nx = e1[1] * e2[2] - e1[2] * e2[1]
    ny = e1[2] * e2[0] - e1[0] * e2[2]
    nz = e1[0] * e2[1] - e1[1] * e2[0]
    
    # Normalize
    length = (nx**2 + ny**2 + nz**2) ** 0.5
    if length > 0:
        nx /= length
        ny /= length
        nz /= length
    
    return (nx, ny, nz)

# Write binary STL
with open('test-cube.stl', 'wb') as f:
    # Header (80 bytes)
    header = b'Test cube 10mm x 10mm x 10mm for scan-to-CAD pipeline'
    f.write(header.ljust(80, b'\0'))
    
    # Number of triangles
    f.write(struct.pack('<I', len(triangles)))
    
    # Write each triangle
    for tri in triangles:
        v1 = vertices[tri[0]]
        v2 = vertices[tri[1]]
        v3 = vertices[tri[2]]
        
        # Compute normal
        normal = compute_normal(v1, v2, v3)
        
        # Write normal (3 floats)
        f.write(struct.pack('<fff', *normal))
        
        # Write vertices (3 x 3 floats)
        f.write(struct.pack('<fff', *v1))
        f.write(struct.pack('<fff', *v2))
        f.write(struct.pack('<fff', *v3))
        
        # Attribute byte count (unused)
        f.write(struct.pack('<H', 0))

print("Created test-cube.stl (12 triangles, 10mm cube)")
