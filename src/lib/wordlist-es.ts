/**
 * Palabras comunes en español para el generador de contraseñas: sustantivos
 * de 4 a 10 letras, solo a-z (sin tildes ni ñ), sin nombres propios ni
 * términos de la empresa, y ninguna presente en la lista de contraseñas
 * comunes.
 */
const WORDS = `
  abanico abeja abrigo abuela aceite acero acorde acuarela adobe adoquin
  aduana agenda aguja ajedrez alambre alameda albahaca alcalde aldea alerce
  alfombra algodon almacen almendra almohada altillo altura amanecer anafe ancla
  andamio anillo antena apio arandano arbol arcilla arena armario armonia
  aroma arroyo arroz asiento atajo atalaya atril avena avion azafran
  azucar azulejo badajo bahia balanza balcon ballena balsa bambu banco
  bandeja baranda barco barniz barrio bastidor batalla baul bellota berenjena
  biblioteca bigote billete bisagra bisonte bloque bocina bodega boleto bolsillo
  bombilla bordado borde bosque botella boton brasa brillo brisa brocal
  brocha bronce brujula bufanda buhardilla buzon caballo cabana cabestro cabina
  cacao cadena cajon calabaza calendario calle calzada camelia camello camino
  camisa campana campo canasta candado canela canoa cantaro canto capullo
  caracol caramelo carpeta carreta carrete carrizo carta cascada casco catre
  cebolla cedro celosia ceniza cepillo cereza cerezo cerro cerrojo cesta
  chacra chaleco charco chimenea cielo cigarra ciruela cisne claustro clavel
  clavo cobertizo cobre cocina codorniz cofre cohete cojin colibri colina
  collar colmena columpio comarca cometa compas concha copa corcho cordel
  cordillera cornisa corral correo cortina cosecha crayon cristal cuaderno cuadro
  cubeta cuchara cuenco cuerda cumbre cuna cupula dado danza dedal
  dehesa delfin desierto destello diamante dibujo diente dintel dique doblez
  ducha duna durazno ebanista ebano edificio embudo enchufe encina enebro
  engrane ensalada ensenada escalera escarcha esclusa escoba escollera escudo esfera
  esmalte espejo espiga espino esponja espuma esquina establo estante estepa
  estero estufa etiqueta fabrica fanal faro farol fibra fideo flauta
  flecha fogata follaje fosforo frasco fresa fruta fuelle fuente funda
  gaita galleta galpon gancho garita garza gaveta gema girasol glaciar
  globo golondrina goma gorra gorrion gotera granito granja grifo grulla
  gruta guadana guante guijarro guitarra hamaca hangar harina hebilla hebra
  helecho helice herradura hielo hierba higuera hilo hoguera hoja hontanar
  hormiga horno horquilla huella huerto huso iglu iman isla jabon
  jardin jarra jaula jazmin jilguero jirafa joya juguete junco junquillo
  ladera ladrillo lago lampara lana lapiz latigo lavanda lazo lechuga
  lechuza leno lente lienzo lima lindero linterna lirio litera llanura
  llave lluvia lodo loma lona loro loseta lucero lupa madeja
  madera maiz maleta maleza manantial manivela manta mantel manzana mapa
  marea marfil margarita marisma marmol martillo mastil matorral mazorca medalla
  melon membrillo menta mesa meseta miel mimbre mirador mirlo mochila
  molino moneda mora morral mosaico muelle mural musgo naranja nave
  nevera nido niebla nogal nopal noria nube nudo nuez nutria
  ocaso olivo olla onda orilla orquidea oruga ostra otero otono
  oveja pajar pajaro palanca paleta palma panal pantano papel paraguas
  pared parque parra pasarela pasillo pastel patio pedal pedernal peine
  peldano pelota penasco pera peral pergola perla persiana pestillo petalo
  picaporte piedra pilar pileta pimienta pincel pino piragua pizarra plancha
  planeta pliegue pluma polea poleo portal postigo pozo pradera puente
  puerta pulpo quebrada quena queso quinua racimo rafaga raiz rama
  rampa rastro rebano regla reloj remanso remo resorte retablo ribera
  riel rincon risco roble roca rocalla rocio rodillo rosal rueda
  ruta sabana sabila salero sandia sarmiento sarten semilla sendero serrin
  serrucho silbato silla sombra sombrero sopa soto surco tabla taller
  tambor tapia tapiz tarima taza techo tejado tejo tela telar
  telon tenedor terraza tetera tierra tijera tilo timon tinaja tinta
  tiza toalla tobogan toldo tomate tomillo tornillo torno torre tortuga
  tranquera travesia trebol tren trigo trineo trompo tronco tuerca tulipan
  tunel umbral vado vagon vaina valle vapor vasija vela velero
  vendaval ventana vereda vergel veta vidrio viento vigia vinagre vinedo
  visera volcan yedra yunque zafiro zaguan zanahoria zapato zarza zurron
`;

export const WORDLIST_ES: readonly string[] = WORDS.split(/\s+/).filter(Boolean);
