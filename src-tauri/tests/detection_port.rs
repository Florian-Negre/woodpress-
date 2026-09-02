// Un port publie par Docker doit etre vu comme occupe, meme s'il reste liable
// en boucle locale sous Docker Desktop pour Windows.
use std::net::TcpListener;
use woodpress_lib::commands::system::{allocate_ports, docker_published_ports, is_port_available};

#[test]
fn un_port_ecoute_localement_est_vu_occupe() {
    let listener = TcpListener::bind(("127.0.0.1", 0)).expect("bind");
    let port = listener.local_addr().unwrap().port();

    let taken = std::collections::HashSet::new();
    assert!(!is_port_available(port, &taken), "un port en ecoute doit etre refuse");
}

#[test]
fn un_port_publie_par_docker_est_refuse() {
    let mut taken = std::collections::HashSet::new();
    taken.insert(64999);
    assert!(!is_port_available(64999, &taken), "un port publie par Docker doit etre refuse");
}

#[test]
fn allocation_multiple_ne_renvoie_pas_de_doublon() {
    let ports = allocate_ports(9600, 9700, 4).expect("4 ports libres attendus");
    assert_eq!(ports.len(), 4);

    let mut uniques = ports.clone();
    uniques.sort_unstable();
    uniques.dedup();
    assert_eq!(uniques.len(), 4, "les ports attribues doivent etre distincts");
}

#[test]
fn la_lecture_des_ports_docker_ne_panique_pas() {
    // Doit fonctionner que Docker soit present ou non
    let _ = docker_published_ports();
}
