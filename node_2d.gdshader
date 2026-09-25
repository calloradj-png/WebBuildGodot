shader_type canvas_item;

uniform float speed = 9.0; 
uniform float amplitude = 3.0;

void vertex() {
    // Каждая буква плывёт волной по синусоиде
    VERTEX.y += sin(TIME * speed + VERTEX.x * 0.05) * amplitude;
}